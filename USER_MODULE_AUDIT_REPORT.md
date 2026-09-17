# EXOHABITAI USER MODULE AUDIT REPORT
**Comprehensive Full-Stack, Security, API, UI/UX, and QA Verification**

- **Project:** ExoHabitAI
- **Auditor Role:** Senior Full-Stack Engineer, Senior UI/UX Auditor, Backend/API Auditor, Security Reviewer, QA Engineer
- **Audit Date:** 2026-09-16
- **Test Suite Status:** 273/273 Passed (100%)
- **Production Build:** Vite v8.0.16 — 0 Errors

---

## 1. Overall Status

| Component / Layer | Status | Key Justification |
| :--- | :--- | :--- |
| **Frontend** | **PASS WITH ISSUES** | Production-grade visual design and modular structure. Contains a JavaScript Temporal Dead Zone (TDZ) variable initialization bug in `AuthContext.jsx`, unhandled duplicate planet storage response in `PredictPage.jsx`, and dead legacy page components. |
| **Backend** | **PASS WITH ISSUES** | Robust pipeline-aware inference (`v2_pipeline_e14f9ac3af0e`), physical validation rules, secure scrypt hashing. However, `/predict_and_store_batch` lacks authentication/user attribution, and `/my_planets` lacks pagination and omits rejection feedback. |
| **Frontend ↔ Backend** | **PASS WITH ISSUES** | Axios client with JWT request interceptor and Vite reverse proxy operates cleanly. Contract gap exists where backend duplicate storage failure returns HTTP 200 with `stored: false`, which `PredictPage.jsx` does not surface to the user. |
| **Authentication** | **PASS WITH ISSUES** | NIST SP 800-63B compliant password length, constant-time verification, automatic logout timer based on JWT expiration. However, `scheduleAutoLogout` references `performLogout` before its declaration, lacks refresh tokens, and registration redirects to `/` instead of `/dashboard`. |
| **Authorization** | **PASS** | Verified via live runtime probes and automated test suite. `@admin_required()` returns HTTP 403 Forbidden (`admin_required`); user submissions are strictly isolated by `created_by_user_id`; claims cannot be spoofed via client payloads. |
| **Database** | **PASS** | `exoplanets` and `users` tables properly structured with unique constraints and indexed foreign keys (`created_by_user_id`). Lacks explicit SQLAlchemy relationship backrefs and cascade definitions. |
| **Security** | **PASS WITH ISSUES** | Zero SQL injection (parameterized ORM), zero XSS sinks (`dangerouslySetInnerHTML` is absent), deactivated account lockout at token lookup. However, `/predict_and_store_batch` allows unauthenticated mass inserts, and in-memory rate-limiter store has unbounded memory growth. |
| **UI/UX** | **PASS WITH ISSUES** | High-end cosmic glassmorphic aesthetics, accessible modals (`Modal.jsx` with focus trap and ARIA attributes), responsive layouts. However, lacks rejection reason feedback on dashboard cards, and "Save prediction to rankings" checkbox is misleading regarding moderation review. |
| **Responsive** | **PASS** | Verified responsive grid breakpoints (`sm:`, `md:`, `lg:`), body scroll locking on mobile nav open, and touch-friendly targets throughout. |
| **Testing** | **PASS** | Backend test suite achieves **273 passed** tests (100% pass rate). Frontend Vite production build succeeds with 0 errors. However, 0 frontend unit/component tests exist in the codebase. |

---

## 2. Critical Issues

### ISSUE-CRIT-01: Temporal Dead Zone (TDZ) Variable Hoisting Bug in `AuthContext.jsx`
- **ID:** ISSUE-CRIT-01
- **Severity:** Critical
- **Location:** `frontend-react/src/context/AuthContext.jsx` (Lines 43–69)
- **Problem:** `scheduleAutoLogout` is declared on line 43 and directly invokes `performLogout()` at lines 53 and 58. However, `const performLogout = useCallback(...)` is declared later on line 63.
- **Evidence:**
  ```javascript
  // AuthContext.jsx: line 43
  const scheduleAutoLogout = useCallback((jwt) => {
    ...
    if (timeUntilExpiry <= 0) {
      performLogout(); // <-- Accessing 'performLogout' before declaration
      return;
    }
  ...
  // AuthContext.jsx: line 63
  const performLogout = useCallback(() => { ... }, [clearLogoutTimer]);
  ```
  ESLint flags this with: `Error: Cannot access variable before it is declared. 'performLogout' is accessed before it is declared`.
- **Impact:** If `scheduleAutoLogout` executes synchronously during initialization with an already expired or near-expired token, JavaScript throws an unhandled `ReferenceError: Cannot access 'performLogout' before initialization`, crashing the React application tree.
- **Recommended Fix:** Move the declaration of `performLogout` above `scheduleAutoLogout` in `AuthContext.jsx`.

---

### ISSUE-CRIT-02: Unauthenticated Mass Insert Route `/predict_and_store_batch`
- **ID:** ISSUE-CRIT-02
- **Severity:** Critical
- **Location:** `backend/app.py` (Lines 1100–1175)
- **Problem:** The route `/predict_and_store_batch` processes bulk predictions and persists rows into the `exoplanets` table with `is_user_generated=True`, but omits the `@jwt_required()` decorator and fails to record `created_by_user_id`.
- **Evidence:**
  ```python
  # app.py: line 1100
  @app.route("/predict_and_store_batch", methods=["POST"])
  def predict_and_store_batch():
      # Missing @jwt_required() decorator
      # Missing current_user_id resolution
      ...
      planet = Exoplanet(
          planet_name=pname,
          ...
          is_user_generated=True,
          # created_by_user_id is omitted (evaluates to NULL)
      )
      db.session.add(planet)
      db.session.commit()
  ```
- **Impact:** Any anonymous public user or script can flood the database with unauthenticated exoplanet records. Furthermore, because `created_by_user_id` is null, these records cannot be traced to any user account in the moderation queue or user dashboard.
- **Recommended Fix:** Add `@jwt_required()`, extract `current_user_id = int(get_jwt_identity())`, and pass `created_by_user_id=current_user_id` into each instantiated `Exoplanet` model.

---

## 3. High-Priority Issues

### ISSUE-HIGH-01: Silent Failure on Duplicate Planet Submissions in `PredictPage.jsx`
- **ID:** ISSUE-HIGH-01
- **Severity:** High
- **Location:** `frontend-react/src/pages/PredictPage.jsx` (Lines 572–587, 869–874)
- **Problem:** When an authenticated user submits a prediction with "Save prediction to rankings" enabled, if the planet name already exists in the database, the backend returns HTTP 200 with `data: { stored: false, storage_message: "Planet '...' already exists" }`. `PredictPage.jsx` only checks `result.stored` when displaying the green success badge. When `stored === false`, no notification or error is displayed.
- **Evidence:**
  ```javascript
  // PredictPage.jsx: lines 869-874
  {result.stored && (
    <div className="text-[10px] text-success bg-success/5 border border-success/10 p-4 rounded-lg text-center font-medium">
      ✅ Prediction saved to your account and observatory database.
    </div>
  )}
  // If result.stored is false, NO warning or message is displayed!
  ```
- **Impact:** The user believes the planet was saved to their account when the database write actually failed. The submission never appears in `/my_planets`.
- **Recommended Fix:** Render an explicit warning alert when `result.stored === false`:
  ```jsx
  {result.stored === false && (
    <div className="text-xs text-warning bg-warning/10 border border-warning/20 p-3.5 rounded-lg text-center font-medium">
      ⚠️ Prediction calculated, but not saved to account: {result.storage_message}
    </div>
  )}
  ```

---

### ISSUE-HIGH-02: Complete Omission of Rejection Reason in User Dashboard
- **ID:** ISSUE-HIGH-02
- **Severity:** High
- **Location:** `backend/app.py` (Lines 1460–1474) and `frontend-react/src/pages/UserDashboardPage.jsx` (Lines 665–715)
- **Problem:** The `Exoplanet` table stores `rejection_reason = db.Column(db.Text)`. When administrators reject a submission in `ModerationPage.jsx`, they input a reason. However, the `/my_planets` endpoint strips `rejection_reason` from the response dictionary, and `UserDashboardPage.jsx` never displays it.
- **Evidence:**
  ```python
  # app.py: line 1460
  entries = [
      {
          "id": p.id,
          "planet_name": p.planet_name,
          "habitability": p.habitability,
          "habitability_probability": ...,
          "status": p.status,
          "model_version": p.model_version,
          "created_at": p.created_at.isoformat() if p.created_at else None,
          # MISSING: "rejection_reason": p.rejection_reason
      }
      for p in planets
  ]
  ```
- **Impact:** Users whose submissions are rejected see a red "Rejected" badge with zero scientific feedback, defeating the continuous feedback and scientific contribution loop.
- **Recommended Fix:** Include `"rejection_reason": p.rejection_reason` in `/my_planets` and render a disclosure banner on rejected cards in `UserDashboardPage.jsx`.

---

## 4. Medium-Priority Issues

### ISSUE-MED-01: Registration Redirect Lands on Homepage Instead of Dashboard
- **ID:** ISSUE-MED-01
- **Severity:** Medium
- **Location:** `frontend-react/src/pages/RegisterPage.jsx` (Lines 21–28)
- **Problem:** In `RegisterPage.jsx`, `redirectPath` defaults to `'/'` instead of `'/dashboard'`.
- **Evidence:**
  ```javascript
  const queryParams = new URLSearchParams(location.search);
  const redirectPath = queryParams.get('redirect') || '/'; // <-- Defaults to landing page
  ```
- **Impact:** Upon registration, the user is automatically logged in, but redirected to the homepage rather than their newly created astronomer dashboard.
- **Recommended Fix:** Change default fallback from `'/'` to `'/dashboard'`.

---

### ISSUE-MED-02: Missing Pagination on `/my_planets` and User Dashboard
- **ID:** ISSUE-MED-02
- **Severity:** Medium
- **Location:** `backend/app.py` (Lines 1453–1458) and `frontend-react/src/pages/UserDashboardPage.jsx` (Lines 110–135)
- **Problem:** `/my_planets` executes an unbounded `.all()` query without `page` or `limit` parameters.
- **Evidence:**
  ```python
  planets = (
      Exoplanet.query
      .filter(Exoplanet.created_by_user_id == current_user_id)
      .order_by(Exoplanet.created_at.desc())
      .all()
  )
  ```
- **Impact:** If an active astronomer submits hundreds of candidates, API latency, serialization overhead, and frontend DOM element count will degrade performance.
- **Recommended Fix:** Implement standard pagination parameters `?page=1&per_page=20`.

---

### ISSUE-MED-03: In-Memory Rate Limiter Unbounded Growth
- **ID:** ISSUE-MED-03
- **Severity:** Medium
- **Location:** `backend/app.py` (Lines 232–245)
- **Problem:** The `_rate_limit_store` dictionary stores timestamps keyed by client IP without time-to-live (TTL) eviction or size limits.
- **Evidence:**
  ```python
  _rate_limit_store: dict[str, float] = {}
  def _check_rate_limit() -> bool:
      ip = request.remote_addr or "unknown"
      now = _monotime()
      ...
      _rate_limit_store[ip] = now  # Dictionary keys are never pruned
  ```
- **Impact:** Over extended server uptime in production, unique scanning and client IPs cause slow memory leakage.
- **Recommended Fix:** Implement an LRU cache or periodic cleanup loop that purges timestamps older than 60 seconds.

---

### ISSUE-MED-04: Misleading Checkbox Label in `PredictPage.jsx`
- **ID:** ISSUE-MED-04
- **Severity:** Medium
- **Location:** `frontend-react/src/pages/PredictPage.jsx` (Lines 770–780)
- **Problem:** The checkbox in `PredictPage.jsx` is labeled: `"Save prediction to rankings"`.
- **Evidence:** User-submitted planets default to `PlanetStatus.PENDING`. As verified in `/rank`, public rankings strictly filter for `status == PlanetStatus.APPROVED`.
- **Impact:** Users check this box expecting their planet to show up on the `/rankings` leaderboard immediately, and assume the platform is broken when it does not appear.
- **Recommended Fix:** Rename label to: `"Save prediction to my account (submits for ranking review)"`.

---

## 5. Low-Priority / Polish Issues

### ISSUE-LOW-01: Admin Users Lack Link to Admin Console in Main Layout
- **ID:** ISSUE-LOW-01
- **Severity:** Low
- **Location:** `frontend-react/src/layouts/MainLayout.jsx` (Lines 178–219)
- **Problem:** When an authenticated user with `role === 'admin'` opens the user dropdown or mobile drawer, an "Admin" badge is shown, but no navigational link to `/admin` is provided.
- **Impact:** Admin users must manually type `/admin` into the browser address bar to reach the operations console.
- **Recommended Fix:** Add a conditional `<NavLink to="/admin">Admin Console</NavLink>` inside the user dropdown if `user?.role === 'admin'`.

---

### ISSUE-LOW-02: Submitted Physical Parameters Inaccessible from Dashboard
- **ID:** ISSUE-LOW-02
- **Severity:** Low
- **Location:** `backend/app.py` (Lines 1460–1474)
- **Problem:** `/my_planets` returns metadata and predictions, but omits the 9 physical features (`P_RADIUS`, `P_MASS`, etc.).
- **Impact:** Users cannot inspect what numerical parameters they originally submitted for an evaluated candidate.
- **Recommended Fix:** Return stored features in `/my_planets` and provide a detail view or modal in `UserDashboardPage.jsx`.

---

### ISSUE-LOW-03: Dead Code in Frontend Pages Directory
- **ID:** ISSUE-LOW-03
- **Severity:** Low
- **Location:** `frontend-react/src/pages/HistoryPage.jsx` and `frontend-react/src/pages/ProfilePage.jsx`
- **Problem:** In `AppRoutes.jsx`, routes `/history`, `/my-predictions`, and `/profile` are redirected to `/dashboard`. `HistoryPage.jsx` and `ProfilePage.jsx` are never imported or rendered.
- **Impact:** Bloats the repository and causes confusion during code maintenance.
- **Recommended Fix:** Safely delete `HistoryPage.jsx` and `ProfilePage.jsx`.

---

## 6. Frontend ↔ Backend API Matrix

| Feature / Flow | Frontend Component | Frontend API Call | Backend Route | DB Interaction | Auth Required | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Register** | `RegisterPage.jsx` | `authAPI.register()` | `POST /auth/register` | `User.query.filter`, `db.session.add(User)` | No | **PASS** |
| **Login** | `LoginPage.jsx` | `authAPI.login()` | `POST /auth/login` | `User.query.filter`, `check_password` | No | **PASS** |
| **Get Profile** | `AuthContext.jsx` | `authAPI.getProfile()` | `GET /auth/me` | `user_lookup_callback` (DB query) | Bearer Token | **PASS** |
| **Update Profile** | `UserDashboardPage.jsx` | `authAPI.updateProfile()` | `PUT /auth/me` | `User.username`, `User.email` commit | Bearer Token | **PASS** |
| **Logout** | `MainLayout.jsx` | `authAPI.logout()` | `POST /auth/logout` | None (Stateless JWT log) | Bearer Token | **PASS** |
| **Single Predict (Guest)** | `PredictPage.jsx` | `predictionAPI.predict()` | `POST /predict` | None (inference only) | No | **PASS** |
| **Predict & Store (User)** | `PredictPage.jsx`, `AddPlanetPage.jsx`, `UserDashboardPage.jsx` | `predictionAPI.predictAndStore()` | `POST /predict_and_store` | `Exoplanet.query.filter_by`, `db.session.add` | Bearer Token | **PASS WITH ISSUES** (Silent failure on duplicate name) |
| **Batch Predict & Store** | None (Backend only) | Direct HTTP | `POST /predict_and_store_batch` | Bulk `db.session.add` | **None (Should be auth)** | **FAIL** (Missing Auth & User ID) |
| **My Predictions** | `UserDashboardPage.jsx` | `planetsAPI.getMySubmissions()` | `GET /my_planets` | `Exoplanet.created_by_user_id == uid` | Bearer Token | **PASS WITH ISSUES** (Missing rejection reason & pagination) |
| **Public Rankings** | `RankingsPage.jsx` | `rankingsAPI.getRankings()` | `GET /rank` | `status == PlanetStatus.APPROVED` | No | **PASS** |
| **Pipeline Metadata** | `PredictPage.jsx` | Direct Axios | `GET /pipeline_info` | None (in-memory model introspect) | No | **PASS** |

---

## 7. Authentication & Authorization Matrix

| Endpoint | Authentication Decorator | Authorization Logic | User Ownership Enforcement | Verified Status |
| :--- | :--- | :--- | :--- | :--- |
| `POST /auth/register` | None (Public) | Default role enforced as `"user"` | Self-contained | **PASS** (Admin creation blocked) |
| `POST /auth/login` | None (Public) | Rejects `is_active=False` accounts | Self-contained | **PASS** (Deactivated users blocked) |
| `GET /auth/me` | `@jwt_required()` | Any authenticated user | Returns `current_user` only | **PASS** |
| `PUT /auth/me` | `@jwt_required()` | Any authenticated user | Can only update own `username`/`email` | **PASS** (Role escalation blocked) |
| `POST /auth/logout` | `@jwt_required()` | Any authenticated user | Client discards token | **PASS** |
| `POST /predict` | None (Public) | None | N/A (no database persistence) | **PASS** |
| `POST /predict_and_store` | `@jwt_required()` | Any authenticated user | Sets `created_by_user_id = jwt.sub` | **PASS** (Cannot spoof user ID) |
| `POST /predict_and_store_batch`| **None** | **None** | **None (`created_by_user_id = None`)** | **FAIL** (Vulnerable to abuse) |
| `GET /my_planets` | `@jwt_required()` | Any authenticated user | `filter(created_by_user_id == jwt.sub)` | **PASS** (Strict tenant isolation) |
| `GET /admin/*` (All routes) | `@admin_required()` | Checks `claims["role"] == "admin"` | Admin control plane | **PASS** (Returns 403 to regular users) |

---

## 8. User Data Flow

```
+---------------------------------------------------------------------------------------------------+
| USER WORKFLOW TRACE                                                                               |
+---------------------------------------------------------------------------------------------------+
                                                                                                    
 [User] ---> Submits credentials (username, password)                                               
    |                                                                                               
    v                                                                                               
 [Frontend (LoginPage.jsx)] ---> POST /auth/login                                                   
    |                                                                                               
    v                                                                                               
 [Backend (auth/routes.py)] ---> Verifies password via check_password_hash (scrypt)                 
    |                            Issues signed JWT with claims: {sub: user.id, role: user.role}      
    v                                                                                               
 [Frontend (AuthContext.jsx)] -> Stores JWT in localStorage ('exohabitai_token')                    
    |                            Configures Axios client request interceptor                        
    v                                                                                               
 [Dashboard / Predict Page] ---> POST /predict_and_store with { Authorization: "Bearer <token>" }   
    |                                                                                               
    v                                                                                               
 [Backend (app.py)] -----------> 1. Validates physical constraints (P_RADIUS > 0, etc.)            
    |                            2. Auto-derives missing features (P_FLUX, P_GRAVITY, etc.)         
    |                            3. Runs unified ML pipeline (imputation + scaling + classifier)    
    |                            4. Extracts current_user_id from get_jwt_identity()                
    |                            5. Inserts Exoplanet with:                                         
    |                                 - status = 'pending'                                          
    |                                 - is_user_generated = True                                    
    |                                 - created_by_user_id = current_user_id                        
    v                                                                                               
 [Database (SQLite/Postgres)] -> Persists record with unique constraint on planet_name              
    |                                                                                               
    v                                                                                               
 [Backend Response] -----------> Returns 200 OK: { status: "success", data: { stored: true, ... } } 
    |                                                                                               
    v                                                                                               
 [User Dashboard] -------------> Triggers reloadToken increment -> GET /my_planets                  
    |                            Queries Exoplanet where created_by_user_id == current_user_id      
    |                            Renders candidate card under "Pending Review" tab                  
    v                                                                                               
 [Public Leaderboard] ---------> GET /rank queries Exoplanet where status == 'approved'             
                                 User submission is SAFELY EXCLUDED until approved by Admin        
```

### Flow Audit Assessment:
- **Intact Links:** Login, token storage, request header injection, physical validation, prediction inference, user ID binding, tenant-isolated history query, and pending planet isolation from public rankings are completely intact and verified at runtime.
- **Broken Link Identified:** If the user submits a duplicate planet name via `PredictPage.jsx`, the backend returns HTTP 200 with `stored: false`. The frontend fails to surface this to the user, breaking the user feedback loop.

---

## 9. UI/UX Findings

### 1. Functional UI Problems
- **Duplicate Planet Notification:** On `PredictPage.jsx`, duplicate names fail storage silently while displaying the prediction score. The user is never alerted that the planet could not be saved to their account.
- **Missing Rejection Context:** In `UserDashboardPage.jsx`, a rejected planet displays only a red "Rejected" badge with no access to the reason provided by the reviewer.
- **Orphaned Profile & History Pages:** `HistoryPage.jsx` and `ProfilePage.jsx` exist in `src/pages/` but are dead code due to redirect rules in `AppRoutes.jsx`.

### 2. Responsive Design Problems
- **No major breakpoint flaws found:** Mobile viewport testing confirmed that the navigation menu collapses into an animated drawer (`<AnimatePresence>`), the body scroll is correctly locked when the menu is open, cards switch from 3 columns (`lg:grid-cols-3`) to single column (`grid-cols-1`), and form fields maintain touch-friendly padding (`min-h-[44px]`).

### 3. Accessibility Problems
- **Form Descriptions:** In `AddPlanetPage.jsx`, input fields reference `aria-describedby={errorState ? 'planet-form-error' : undefined}`, but when no error exists, the description tooltip icon is not linked via `aria-describedby`.
- **Modal Focus Trap:** `Modal.jsx` correctly implements focus trapping, Escape-to-close, and restores focus to `previousActiveRef.current`. Passed accessibility review.

### 4. Visual Consistency Problems
- **Label Inaccuracy:** `PredictPage.jsx` uses the label `"Save prediction to rankings"`, which contradicts the moderation workflow where all user-submitted planets must undergo administrative review before appearing in rankings.

---

## 10. Security Findings

### CONFIRMED Vulnerabilities

1. **Unauthenticated Bulk Insertion Endpoint (`/predict_and_store_batch`)**
   - *Status:* CONFIRMED
   - *Detail:* Anyone can send HTTP POST requests with large JSON arrays to `/predict_and_store_batch` without authentication. Rows are written to the database without a `created_by_user_id`.
   - *CVSS Estimate:* 6.5 (Medium) — CWE-306: Missing Authentication for Critical Function.

2. **Temporal Dead Zone Reference Error in Auth Context**
   - *Status:* CONFIRMED
   - *Detail:* `scheduleAutoLogout` references `performLogout` before its initialization in `AuthContext.jsx`.
   - *CWE:* CWE-703: Improper Check or Handling of Exceptional Conditions.

### POTENTIAL Risks Requiring Verification in Production

1. **Default Insecure Secret Keys in Development**
   - *Status:* POTENTIAL RISK
   - *Detail:* `backend/config.py` defaults to `SECRET_KEY = "dev-secret-key-change-in-prod"` and `JWT_SECRET_KEY = "jwt-dev-secret-change-in-prod"`. While the app logs a warning on startup, deployment without overriding `.env` would compromise all session and token signatures.
2. **Unbounded In-Memory Rate Limiting**
   - *Status:* POTENTIAL RISK
   - *Detail:* `_rate_limit_store` in `app.py` stores IPs indefinitely. In production under reverse proxies, `request.remote_addr` will also be the proxy IP unless `X-Forwarded-For` is handled via Werkzeug's `ProxyFix`.
3. **Absence of Refresh Tokens / Token Revocation Blocklist**
   - *Status:* ARCHITECTURAL LIMITATION
   - *Detail:* Tokens expire after 1 hour. If a token is compromised, it cannot be revoked before expiration unless the user account is marked `is_active=False`.

---

## 11. Tests

### Existing Automated Test Suite:
- **Total Tests Executed:** 273
- **Passed:** 273 (100%)
- **Failed:** 0
- **Duration:** 162.08s

### Test Coverage Highlights:
- `tests/test_auth.py`: Covers registration validation, duplicate registration, password hashing verification, JWT generation, expired token rejection, invalid signature rejection, inactive account blocking, and profile update restrictions.
- `tests/test_prediction.py`: Covers single and batch prediction, physical sanity bounds, automatic feature derivation, and pipeline consistency.
- `tests/test_moderation.py`: Covers planet submission, default `pending` status, admin approval/rejection lifecycle, and exclusion of pending planets from public rankings.
- `tests/test_admin_protection.py`: Verifies regular users are denied access to control plane endpoints.

### Missing Test Coverage:
1. **Frontend Unit / Integration Tests:** 0 tests exist in `frontend-react` (no Vitest/Jest configuration).
2. **Batch Storage Auth Test:** No test asserts whether `/predict_and_store_batch` requires authentication (which masked ISSUE-CRIT-02).
3. **Duplicate Submission Frontend Handling:** No integration test checks UI behavior when `stored: false` is returned.

---

## 12. Unused / Dead Code

| Item | Type | Path | Evidence |
| :--- | :--- | :--- | :--- |
| `HistoryPage.jsx` | React Component | `frontend-react/src/pages/HistoryPage.jsx` | Route `/history` redirects directly to `/dashboard`. Component is never rendered. |
| `ProfilePage.jsx` | React Component | `frontend-react/src/pages/ProfilePage.jsx` | Route `/profile` redirects directly to `/dashboard`. Component is never rendered. |
| `/add_planet` | Flask Route | `backend/app.py` (Lines 995–1012) | Deprecated route returning HTTP 410 Gone. Superseded by `/predict_and_store`. |
| `handleBlur` | JS Variable | `frontend-react/src/pages/PredictPage.jsx` (Line 553) | Assigned a value but never invoked (flagged by ESLint). |

---

## 13. Recommended Fix Order

1. **ISSUE-CRIT-01 (Frontend TDZ Bug):** In `frontend-react/src/context/AuthContext.jsx`, reorder `performLogout` before `scheduleAutoLogout`.
2. **ISSUE-CRIT-02 (Backend Security):** Add `@jwt_required()` and assign `created_by_user_id` to `/predict_and_store_batch` in `backend/app.py`.
3. **ISSUE-HIGH-01 (Predict Page Feedback):** Update `PredictPage.jsx` to display a warning message when `result.stored === false`.
4. **ISSUE-HIGH-02 (Moderation Transparency):** Add `"rejection_reason": p.rejection_reason` to the `/my_planets` response in `backend/app.py` and display it in `UserDashboardPage.jsx`.
5. **ISSUE-MED-01 (Registration Onboarding):** Change default redirect fallback in `RegisterPage.jsx` to `'/dashboard'`.
6. **ISSUE-MED-04 (UI Label Clarification):** Rename `"Save prediction to rankings"` in `PredictPage.jsx` to `"Save prediction to my account (pending review)"`.
7. **ISSUE-LOW-01 (Admin Ergonomics):** Add `<NavLink to="/admin">` to the `MainLayout.jsx` user dropdown when `user?.role === 'admin'`.
8. **ISSUE-LOW-03 (Repository Cleanup):** Remove dead components `HistoryPage.jsx` and `ProfilePage.jsx`.

---

## 14. FINAL VERDICT

### What Was Actually Verified:
- **Source Code Verification:** Completely audited all lines of `backend/app.py`, `backend/auth/*`, `backend/models/*`, `backend/config.py`, `frontend-react/src/pages/*`, `frontend-react/src/context/*`, `frontend-react/src/api/*`, `frontend-react/src/layouts/*`, and `frontend-react/src/routes/*`.
- **Runtime API Verification:** Executed live probes against the running Flask backend server (`http://127.0.0.1:5000`): verified registration, authentication, JWT header transmission, profile modification via `PUT /auth/me`, physical validation, habitability prediction inference (`v2_pipeline_e14f9ac3af0e`), database persistence, and multi-tenant separation.
- **Authorization Verification:** Executed live unauthorized requests against `/admin/dashboard` and `/admin/planets/pending` using regular user credentials; verified rejection with HTTP 403 `admin_required`.
- **Rankings Isolation Verification:** Created an exoplanet candidate via `/predict_and_store`, verified its persistence in `exoplanets` with status `pending`, verified its presence in `/my_planets`, and confirmed its complete absence from `/rank`.
- **Build & Test Verification:** Ran full test suite via `pytest` (273 passed in 162s) and full production build via `npm run build` (Vite built `dist/` in 2.01s with 0 errors).

### What Passed:
- User registration, login, and session persistence.
- Role-based authorization and route protection (`ProtectedRoute`, `AdminRoute`, `@admin_required`).
- User data isolation (User A cannot view or tamper with User B's predictions).
- Single prediction and user planet storage (`/predict` and `/predict_and_store`).
- Real-time user statistics derivation on the User Dashboard.
- Modal accessibility and focus trapping in `Modal.jsx`.
- Production bundle build compilation.

### What Failed:
- `/predict_and_store_batch` route is unauthenticated and omits user ownership tracking.
- `AuthContext.jsx` contains a variable declaration order TDZ bug.
- `PredictPage.jsx` fails silently when duplicate planet names are rejected by the database.
- Rejection reasons are stripped from user-facing APIs and never displayed on dashboard cards.
- Registration redirects to `/` instead of `/dashboard`.

### What Requires Manual Browser Verification:
- Visual rendering of the starfield canvas animation across low-powered mobile GPUs.
- Mobile viewport touch response when opening modals on iOS Safari and Android Chrome.

### Verdict Summary:
The ExoHabitAI user module is **substantially complete, feature-rich, visually outstanding, and functionally integrated**. It is **NOT** merely a cosmetic UI; the full database-to-UI pipeline is genuinely working. However, it cannot be considered fully **production-quality** until the 2 Critical and 2 High-priority issues identified above are resolved.
