import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { resetSimulator } from '../firebase/firestoreService';
import { signOut } from '../firebase/authService';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const { currentUser, userProfile } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState('');
  
  // Profile update state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [updateMsg, setUpdateMsg] = useState('');
  const [updating, setUpdating] = useState(false);

  const handleUpdateName = () => {
    if (!editName.trim() || editName === userProfile?.displayName) {
      setIsEditingName(false);
      return;
    }
    
    // Instant UI update (Optimistic)
    setUpdateMsg('Name updated successfully!');
    setIsEditingName(false);
    
    // Background Firebase updates
    import('firebase/auth').then(({ updateProfile }) => {
      updateProfile(currentUser, { displayName: editName }).catch(console.error);
    });
    
    import('../firebase/firestoreService').then(({ updateUserProfile }) => {
      updateUserProfile(currentUser.uid, { displayName: editName }).catch(console.error);
    });
  };

  const handleResetSimulator = async () => {
    if (!confirm('Are you sure you want to reset your simulator account? This will erase all trades and set your balance back to ₹1,000,000.')) {
      return;
    }
    setResetting(true);
    setMessage('');
    try {
      await resetSimulator(currentUser.uid);
      setMessage('Simulator account reset successfully.');
    } catch (err) {
      setMessage('Failed to reset account: ' + err.message);
    } finally {
      setResetting(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const initials = (userProfile?.displayName || currentUser?.email || 'U')
    .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>👤 My Profile</h1>
        <p>Manage your account settings and preferences.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Personal Info Card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Personal Information</span>
          </div>
          <div className="card-body">
            
            {updateMsg && (
              <div className={updateMsg.includes('success') ? 'success-msg' : 'error-msg'} style={{ marginBottom: '16px' }}>
                {updateMsg}
              </div>
            )}
            
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              <div style={{ 
                width: '80px', height: '80px', borderRadius: '50%', 
                background: 'var(--brand)', color: '#000', 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '32px', fontWeight: '800', flexShrink: 0
              }}>
                {currentUser?.photoURL ? (
                  <img src={currentUser.photoURL} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  initials
                )}
              </div>
              <div style={{ flexGrow: 1 }}>
                
                {isEditingName ? (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={editName} 
                      onChange={(e) => setEditName(e.target.value)} 
                      placeholder="Display Name" 
                      autoFocus 
                    />
                    <button className="btn btn-secondary btn-sm" onClick={handleUpdateName}>
                      Save
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setIsEditingName(false)}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--t-0)' }}>
                      {userProfile?.displayName || 'Trader'}
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setIsEditingName(true); setEditName(userProfile?.displayName || ''); }}>
                      ✎ Edit
                    </button>
                  </div>
                )}
                
                <div style={{ color: 'var(--t-2)', fontSize: '14px', marginTop: '4px' }}>
                  {currentUser?.email}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Preferences Card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">App Preferences</span>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: '600', color: 'var(--t-0)' }}>Appearance</div>
                <div style={{ fontSize: '13px', color: 'var(--t-3)', marginTop: '2px' }}>Toggle between Dark and Light mode</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '13px', color: 'var(--t-2)' }}>{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
                <label className="toggle">
                  <input type="checkbox" checked={theme === 'dark'} onChange={toggle} />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="card" style={{ gridColumn: '1 / -1', border: '1px solid var(--red-border)' }}>
          <div className="card-header" style={{ borderBottom: '1px solid var(--red-border)' }}>
            <span className="card-title" style={{ color: 'var(--red)' }}>Danger Zone</span>
          </div>
          <div className="card-body">
            {message && (
              <div className={message.includes('success') ? 'success-msg' : 'error-msg'} style={{ marginBottom: '16px' }}>
                {message}
              </div>
            )}
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <div style={{ fontWeight: '600', color: 'var(--t-0)' }}>Reset Simulator Account</div>
                <div style={{ fontSize: '13px', color: 'var(--t-3)', marginTop: '2px' }}>
                  Erase all trade history and reset virtual balance to ₹10,00,000. This action cannot be undone.
                </div>
              </div>
              <button 
                className="btn btn-red" 
                onClick={handleResetSimulator}
                disabled={resetting}
              >
                {resetting ? 'Resetting...' : 'Reset Account'}
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: '600', color: 'var(--t-0)' }}>Sign Out</div>
                <div style={{ fontSize: '13px', color: 'var(--t-3)', marginTop: '2px' }}>
                  Log out of your account on this device.
                </div>
              </div>
              <button className="btn btn-secondary" onClick={handleSignOut}>
                Sign Out
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
