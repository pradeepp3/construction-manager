// Authentication Module — Premium Login View

async function login(username, password) {
    try {
        showLoading();
        const result = await window.api.auth.login({ username, password });

        if (result.success) {
            AppState.currentUser = result.user;
            // Update user chip in header
            const chip = document.getElementById('userNameChip');
            const avatar = document.getElementById('userAvatarChip');
            if (chip) chip.textContent = result.user.username || 'Admin';
            if (avatar) avatar.textContent = (result.user.username || 'A').charAt(0).toUpperCase();

            showToast('Welcome back! Login successful.', 'success');
            await loadCurrentProject();
            navigateTo('projects');
        } else {
            showToast(result.message || 'Invalid credentials. Please try again.', 'danger');
        }
    } catch (error) {
        showToast('Login error: ' + error.message, 'danger');
    } finally {
        hideLoading();
    }
}

async function logout() {
    try {
        await window.api.auth.logout();
        AppState.currentUser = null;
        AppState.currentProject = null;
        localStorage.removeItem('currentProjectId');
        showToast('Logged out successfully.', 'info');
        navigateTo('login');
    } catch (error) {
        showToast('Logout error: ' + error.message, 'danger');
    }
}

function loadLoginView() {
    return `
        <div class="login-page">
            <!-- Left Panel: Branding -->
            <div class="login-left">
                <div class="login-mesh"></div>
                <div class="login-grid-lines"></div>

                <div class="login-brand-mark">
                    <img src="assets/icons/icon.png" alt="Kumaran Infratech logo" class="big-logo" />
                    <h1>Kumaran Infratech</h1>
                    <p>Construction Operations Platform — Enterprise Edition</p>
                </div>

                <div class="login-stats">
                    <div class="login-stat-pill">
                        <i class="ph ph-buildings"></i>
                        <span><strong>Multi-Project</strong> resource management at scale</span>
                    </div>
                    <div class="login-stat-pill">
                        <i class="ph ph-chart-line-up"></i>
                        <span><strong>Real-time</strong> budget tracking &amp; cost analysis</span>
                    </div>
                    <div class="login-stat-pill">
                        <i class="ph ph-users-three"></i>
                        <span><strong>Complete</strong> labour &amp; attendance management</span>
                    </div>
                    
                </div>
            </div>

            <!-- Right Panel: Login Form -->
            <div class="login-right">
                <div class="login-form-card">
                    <div style="margin-bottom: 2rem;">
                        <div class="login-form-title">Welcome back</div>
                        <div class="login-form-sub">Sign in to your operations dashboard</div>
                    </div>

                    <form id="loginForm" onsubmit="event.preventDefault(); handleLogin();">
                        <div class="form-group">
                            <label class="form-label">Username</label>
                            <div style="position:relative;">
                                <i class="ph ph-user" style="position:absolute; left:.85rem; top:50%; transform:translateY(-50%); color:var(--text-muted); font-size:1rem; pointer-events:none;"></i>
                                <input
                                    type="text"
                                    id="loginUsername"
                                    class="form-input"
                                    style="padding-left: 2.5rem;"
                                    required
                                    autofocus
                                    placeholder="Enter your username"
                                />
                            </div>
                        </div>
                        <div class="form-group" style="margin-bottom: 1.5rem;">
                            <label class="form-label">Password</label>
                            <div style="position:relative;">
                                <i class="ph ph-lock" style="position:absolute; left:.85rem; top:50%; transform:translateY(-50%); color:var(--text-muted); font-size:1rem; pointer-events:none;"></i>
                                <input
                                    type="password"
                                    id="loginPassword"
                                    class="form-input"
                                    style="padding-left: 2.5rem;"
                                    required
                                    placeholder="Enter your password"
                                />
                            </div>
                        </div>

                        <button type="submit" class="btn btn-primary btn-lg w-full" style="margin-bottom: 1rem;">
                            <i class="ph ph-sign-in"></i>
                            Sign In to Platform
                        </button>

                        <div style="text-align: center; color: var(--text-muted); font-size: .78rem; padding: .75rem; background: var(--bg-hover); border-radius: var(--r-md); border: 1px solid var(--border);">
                            <i class="ph ph-info" style="margin-right:.3rem;"></i>
                            Default credentials: <strong style="color: var(--text-secondary);">admin</strong> / <strong style="color: var(--text-secondary);">admin123</strong>
                        </div>
                    </form>

                    <div style="margin-top: 2rem; text-align: center; font-size: .75rem; color: var(--text-muted);">
                        © 2024 Kumaran Infratech Pvt. Ltd. · All rights reserved
                    </div>
                </div>
            </div>
        </div>
    `;
}

function initializeLogin() { /* inline handlers */ }

function handleLogin() {
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    login(username, password);
}

// Expose globally
window.loadLoginView = loadLoginView;
window.initializeLogin = initializeLogin;
window.handleLogin = handleLogin;
window.login = login;
window.logout = logout;
