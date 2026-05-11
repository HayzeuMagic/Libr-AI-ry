import React, { useEffect, useState } from 'react';
import api from '../services/api';
import './AdminAccounts.css';

function AdminAccounts() {
  const [users, setUsers] = useState([]);
  const [csvFile, setCsvFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState([]);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/list-users/');
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setUsers([]);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!csvFile) {
      setMessage('Please select a CSV file first.');
      return;
    }

    const formData = new FormData();
    formData.append('file', csvFile);

    setUploading(true);
    setMessage('');
    setErrors([]);

    try {
      const res = await api.post('/bulk-create-users/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const data = res.data || {};
      setMessage(
        `Upload complete. ${data.created || 0} created, ${data.skipped || 0} skipped, ${(data.errors || []).length} row(s) had errors.`
      );
      setErrors(Array.isArray(data.errors) ? data.errors : []);
      setCsvFile(null);
      fetchUsers();
    } catch (err) {
      console.error('Upload failed:', err);
      setMessage(err.response?.data?.error || 'Upload failed.');
      setErrors([]);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="admin-accounts">
      <div className="accounts-header">
        <div>
          <h1>Admin Accounts</h1>
          <p className="accounts-subtitle">Manage users and bulk upload accounts via CSV.</p>
        </div>
      </div>

      <div className="accounts-content">
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Upload Users CSV</h2>
              <p className="card-subtitle">Import multiple users with name, email, and optional password.</p>
            </div>
          </div>

          <form className="upload-form" onSubmit={handleUpload}>
            <input
              className="file-input"
              type="file"
              accept=".csv"
              onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
            />
            <button className="btn-primary" type="submit" disabled={uploading}>
              {uploading ? 'Uploading...' : 'Upload CSV'}
            </button>
          </form>

          {message && <div className="message-box">{message}</div>}

          {errors.length > 0 && (
            <div className="errors-box">
              <h3 className="errors-title">Row Errors</h3>
              <ul className="errors-list">
                {errors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">All Users</h2>
              <p className="card-subtitle">View all registered accounts in the system.</p>
            </div>
          </div>

          <div className="table-container">
            <table className="users-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="empty-state">No users found.</td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id}>
                      <td>{user.id}</td>
                      <td className="user-name">{user.username}</td>
                      <td className="user-email">{user.email}</td>
                      <td>
                        <span className={`role-badge ${user.is_staff ? 'role-admin' : 'role-user'}`}>
                          {user.is_staff ? 'Admin' : 'User'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminAccounts;