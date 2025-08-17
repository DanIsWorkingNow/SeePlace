// This file is part of the Google Places Redux Saga project.
// It defines a loading spinner component that can be used to indicate loading states in the application.
// The spinner can be customized with different sizes and additional CSS classes.
// It uses Tailwind CSS for styling and provides a simple, reusable loading indicator.
import React from 'react';

const LoadingSpinner = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <div className={`${sizeClasses[size]} ${className}`}>
      <div className="animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 w-full h-full"></div>
    </div>
  );
};

export default LoadingSpinner;