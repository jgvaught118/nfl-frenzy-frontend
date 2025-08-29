import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext"; // Import useAuth to access user context

const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();

  // If no user is logged in, redirect to login page
  if (!user) {
    return <Navigate to="/" />; // Redirect to login page
  }

  // If user is logged in, render the protected component
  return children;
};

export default ProtectedRoute;
