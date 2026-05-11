import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { loginUser } from '../../services/auth';
import '../../pages/Login.css';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

function Login() {
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const navigate = useNavigate();

  const hasToken = !!localStorage.getItem('accessToken');
  const isAdminStored = localStorage.getItem('isAdmin') === 'true';

  if (hasToken) {
    return <Navigate to={isAdminStored ? '/admin' : '/chatbot'} replace />;
  }

  const handleChange = (e) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
    setLoginError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    console.log('Login payload', credentials); // temporary debug log

    try {
      const user = await loginUser(credentials);
      const isAdmin = !!user?.is_staff;

      if (isAdmin) {
        navigate('/admin', { replace: true });
      } else {
        navigate('/chatbot', { replace: true });
      }
    } catch (error) {
      console.error('Login error:', error);
      setLoginError('Username or Password is invalid.');
    }
  };

  return (
    <div className="login-layout">
      <div className="login-left">
        <form className="login-form" onSubmit={handleSubmit}>
          <h2 className="form-title">Login</h2>

          <input
            name="email"
            type="text"
            value={credentials.email}
            onChange={handleChange}
            placeholder="Email"
            autoFocus
          />

          <div className="password-wrapper">
            <input
              name="password"
              className="password-input"
              type={showPassword ? 'text' : 'password'}
              value={credentials.password}
              onChange={handleChange}
              placeholder="Password"
            />
            <span
              className="toggle-password"
              onClick={() => setShowPassword((prev) => !prev)}
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </span>
          </div>

          {loginError && <p className="field-error">{loginError}</p>}

          <button type="submit">Login</button>
        </form>
      </div>

      <div className="login-right">
        <img src="/geng-logo.png" alt="Geng" className="big-logo" />
        <h2 className="login-title">Welcome!</h2>
        <p>Please login with your credentials.</p>
      </div>
    </div>
  );
}

export default Login;