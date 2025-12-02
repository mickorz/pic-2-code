
import React from 'react';

const SkeletonLoader: React.FC = () => {
  return (
    <div className="w-full h-full bg-white p-6 space-y-6 overflow-hidden animate-pulse">
      {/* Navbar Skeleton */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
          <div className="w-32 h-6 bg-gray-200 rounded"></div>
        </div>
        <div className="flex gap-4">
          <div className="w-20 h-4 bg-gray-200 rounded"></div>
          <div className="w-20 h-4 bg-gray-200 rounded"></div>
          <div className="w-24 h-8 bg-gray-200 rounded"></div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="grid grid-cols-2 gap-12 mt-12">
        <div className="space-y-4">
          <div className="w-3/4 h-12 bg-gray-200 rounded"></div>
          <div className="w-1/2 h-12 bg-gray-200 rounded"></div>
          <div className="space-y-2 pt-4">
            <div className="w-full h-4 bg-gray-200 rounded"></div>
            <div className="w-full h-4 bg-gray-200 rounded"></div>
            <div className="w-2/3 h-4 bg-gray-200 rounded"></div>
          </div>
          <div className="flex gap-4 pt-4">
            <div className="w-32 h-10 bg-gray-300 rounded"></div>
            <div className="w-32 h-10 bg-gray-200 rounded"></div>
          </div>
        </div>
        <div className="h-64 bg-gray-100 rounded-xl"></div>
      </div>

      {/* Grid Features */}
      <div className="grid grid-cols-3 gap-6 pt-12">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 border border-gray-100 rounded-lg space-y-3">
            <div className="w-10 h-10 bg-gray-200 rounded mb-4"></div>
            <div className="w-3/4 h-5 bg-gray-200 rounded"></div>
            <div className="w-full h-16 bg-gray-100 rounded"></div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SkeletonLoader;
