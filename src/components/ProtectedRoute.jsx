import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { currentUser, loading } = useAuth();
  if (loading) return (
    <div className="loading-screen">
      <div className="spinner"></div>
    </div>
  );
  return currentUser ? children : <Navigate to="/auth" replace />;
};

export default ProtectedRoute;
