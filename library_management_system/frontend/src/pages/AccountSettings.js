import React, { useState } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import api from '../services/api';
import './AccountSettings.css';

const AccountSettings = () => {
  const [passwords, setPasswords] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  // NEW: field-level errors
  const [errors, setErrors] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
    general: '',
  });

  const [message, setMessage] = useState('');

  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const toggleShowPassword = (field) => {
    setShowPassword((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handleChange = (e) => {
    setPasswords({ ...passwords, [e.target.name]: e.target.value });
    // clear error for that field when user types
    setErrors((prev) => ({ ...prev, [e.target.name]: '', general: '' }));
    setMessage('');
  };

  // Same rules the server enforces (users/serializers.py validate_strong_password).
  // The old client rule (9 chars + symbol) accepted passwords the server
  // rejected, which then showed up as "Old password does not match".
  const isStrongPassword = (value) =>
    value.length >= 8 &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /\d/.test(value) &&
    /[^\w\s]/.test(value);

  const PASSWORD_RULE_TEXT =
    'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number and a symbol.';

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setMessage('');
    setErrors({
      current_password: '',
      new_password: '',
      confirm_password: '',
      general: '',
    });

    const { current_password, new_password, confirm_password } = passwords;

    // client-side checks
    const newErrors = {};

    if (!isStrongPassword(new_password)) {
      newErrors.new_password = PASSWORD_RULE_TEXT;
    }

    if (new_password !== confirm_password) {
      newErrors.confirm_password = 'New password and confirm password do not match.';
    }

    // if we already have client-side errors, don't call API
    if (Object.keys(newErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...newErrors }));
      return;
    }

    try {
      await api.post('/change-password/', {
        current_password,
        new_password,
      });

      setMessage('Password updated successfully.');
      setPasswords({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });
    } catch (err) {
      const data = err.response?.data || {};
      const first = (v) => (Array.isArray(v) ? v[0] : v) || '';
      setErrors((prev) => ({
        ...prev,
        current_password: first(data.current_password)
          ? 'Old password does not match.'
          : '',
        new_password: first(data.new_password),
        general:
          data.current_password || data.new_password
            ? ''
            : 'Failed to change password. Please try again.',
      }));
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-container">
        <h1 className="page-title">Account Settings</h1>

        
        {/* Password */}
        <div className="settings-section">
          <h2 className="settings-title">Change Password</h2>
          <form className="form my-form" onSubmit={handlePasswordChange}>
            {/* Current password */}
            <div className="form-group">
              <div className="input-group password-input-group">
                <input
                  name="current_password"
                  placeholder="Old Password"
                  type={showPassword.current ? 'text' : 'password'}
                  className="form-control"
                  autoComplete="current-password"
                  value={passwords.current_password}
                  onChange={handleChange}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => toggleShowPassword('current')}
                  title={showPassword.current ? 'Hide password' : 'View password'}
                >
                  {showPassword.current ? <FaEyeSlash /> : <FaEye />}
                </button>
                <span className="focus-input"></span>
              </div>
              {errors.current_password && (
                <p className="field-error">{errors.current_password}</p>
              )}
            </div>

            {/* New password */}
            <div className="form-group">
              <div className="input-group password-input-group">
                <input
                  name="new_password"
                  placeholder="New Password"
                  type={showPassword.new ? 'text' : 'password'}
                  className="form-control"
                  autoComplete="new-password"
                  value={passwords.new_password}
                  onChange={handleChange}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => toggleShowPassword('new')}
                  title={showPassword.new ? 'Hide password' : 'View password'}
                >
                  {showPassword.new ? <FaEyeSlash /> : <FaEye />}
                </button>
                <span className="focus-input"></span>
              </div>
              {errors.new_password && (
                <p className="field-error">{errors.new_password}</p>
              )}
            </div>

            {/* Confirm password */}
            <div className="form-group">
              <div className="input-group password-input-group">
                <input
                  name="confirm_password"
                  placeholder="Confirm New Password"
                  type={showPassword.confirm ? 'text' : 'password'}
                  className="form-control"
                  autoComplete="new-password"
                  value={passwords.confirm_password}
                  onChange={handleChange}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => toggleShowPassword('confirm')}
                  title={showPassword.confirm ? 'Hide password' : 'View password'}
                >
                  {showPassword.confirm ? <FaEyeSlash /> : <FaEye />}
                </button>
                <span className="focus-input"></span>
              </div>
              {errors.confirm_password && (
                <p className="field-error">{errors.confirm_password}</p>
              )}
            </div>

            <div className="form-submit right">
              <button className="btn button full" type="submit">
                Change Password
              </button>
            </div>

            {errors.general && <p className="account-message error">{errors.general}</p>}
            {message && <p className="account-message success">{message}</p>}
          </form>
        </div>
      </div>
    </div>
  );
};

export default AccountSettings;
