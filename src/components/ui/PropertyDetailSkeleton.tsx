// Skeleton loading for Jual / Lelang / Sewa detail pages
export default function PropertyDetailSkeleton() {
  return (
    <div className="text-white font-sans bg-[#0F0F0F] min-h-screen">
      {/* Navbar spacer */}
      <div className="lg:hidden h-[60px]" />
      <div className="hidden lg:block h-24 w-full" />

      {/* Breadcrumb */}
      <div className="container mx-auto px-4 mb-4 lg:mb-6">
        <div className="flex items-center gap-2">
          <div className="skeleton-shimmer h-3 w-10 rounded" />
          <div className="skeleton-shimmer h-3 w-3 rounded-full" />
          <div className="skeleton-shimmer h-3 w-12 rounded" />
          <div className="skeleton-shimmer h-3 w-3 rounded-full" />
          <div className="skeleton-shimmer h-3 w-48 rounded" />
        </div>
      </div>

      {/* Image Gallery skeleton */}
      <div className="container mx-auto lg:px-4 mb-8 px-4">
        <div className="skeleton-shimmer w-full rounded-2xl overflow-hidden"
             style={{ aspectRatio: "16/7" }} />
        {/* Thumbnail row */}
        <div className="flex gap-2 mt-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="skeleton-shimmer rounded-xl flex-shrink-0"
              style={{ width: "80px", height: "56px" }}
            />
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="container mx-auto px-4 relative">
        <div className="flex flex-col lg:flex-row gap-10 items-start">

          {/* Left — Detail Info */}
          <div className="flex-1 w-full space-y-6">
            {/* Title */}
            <div className="space-y-3">
              <div className="skeleton-shimmer h-8 w-3/4 rounded-lg" />
              <div className="skeleton-shimmer h-5 w-1/2 rounded-lg" />
            </div>

            {/* Tags row */}
            <div className="flex flex-wrap gap-2">
              {[80, 64, 96, 72].map((w, i) => (
                <div
                  key={i}
                  className="skeleton-shimmer h-7 rounded-full"
                  style={{ width: `${w}px` }}
                />
              ))}
            </div>

            {/* Price */}
            <div className="skeleton-shimmer h-10 w-56 rounded-xl" />

            {/* Spec cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="skeleton-shimmer h-20 rounded-xl"
                />
              ))}
            </div>

            {/* Description block */}
            <div className="space-y-2">
              <div className="skeleton-shimmer h-5 w-32 rounded-lg" />
              <div className="skeleton-shimmer h-4 w-full rounded" />
              <div className="skeleton-shimmer h-4 w-full rounded" />
              <div className="skeleton-shimmer h-4 w-4/5 rounded" />
              <div className="skeleton-shimmer h-4 w-3/4 rounded" />
            </div>

            {/* Detail row */}
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="skeleton-shimmer w-8 h-8 rounded-lg flex-shrink-0" />
                  <div className="space-y-1 flex-1">
                    <div className="skeleton-shimmer h-3 w-20 rounded" />
                    <div className="skeleton-shimmer h-4 w-16 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Sidebar */}
          <div className="w-full lg:w-[340px] flex-shrink-0">
            <div className="skeleton-shimmer rounded-2xl p-6 space-y-4 border border-white/5"
                 style={{ background: "transparent" }}>
              <div className="skeleton-shimmer h-6 w-full rounded-xl" />

              {/* Price */}
              <div className="skeleton-shimmer h-10 w-3/4 rounded-xl" />
              <div className="skeleton-shimmer h-4 w-1/2 rounded" />

              <div className="skeleton-shimmer h-px w-full rounded" />

              {/* Agent info */}
              <div className="flex items-center gap-3">
                <div className="skeleton-shimmer w-12 h-12 rounded-full flex-shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="skeleton-shimmer h-4 w-32 rounded" />
                  <div className="skeleton-shimmer h-3 w-24 rounded" />
                </div>
              </div>

              {/* Agent stats */}
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="skeleton-shimmer h-14 rounded-xl" />
                ))}
              </div>

              <div className="skeleton-shimmer h-px w-full rounded" />

              {/* CTA buttons */}
              <div className="skeleton-shimmer h-12 w-full rounded-xl" />
              <div className="skeleton-shimmer h-12 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </div>

      {/* Similar properties section */}
      <div className="container mx-auto px-4 mt-16">
        <div className="skeleton-shimmer h-6 w-48 rounded-lg mb-6" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton-shimmer rounded-2xl h-64" />
          ))}
        </div>
      </div>

      <div className="h-20" />
    </div>
  );
}
