export default function BreakpointsPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-2">
        {/* base (< sm) */}
        <div className="block sm:hidden font-bold text-base">base</div>
        {/* sm (>=640 & <768) */}
        <div className="hidden sm:block md:hidden font-bold text-sm">sm</div>
        {/* md (>=768 & <1200) */}
        <div className="hidden md:block lg:hidden font-bold text-lg">md</div>
        {/* lg (>=1200 & <1440) */}
        <div className="hidden lg:block xl:hidden font-bold text-xl">lg</div>
        {/* xl (>=1440 & <1536) */}
        <div className="hidden xl:block 2xl:hidden font-bold text-2xl">xl</div>
        {/* 2xl (>=1536 & <1708) */}
        <div className="hidden 2xl:block 3xl:hidden font-bold text-3xl">2xl</div>
        {/* 3xl (>=1708 & <1920) */}
        <div className="hidden 3xl:block 4xl:hidden font-bold text-4xl">3xl</div>
        {/* 4xl (>=1920 & <2560) */}
        <div className="hidden 4xl:block 5xl:hidden font-bold text-5xl">4xl</div>
        {/* 5xl (>=2560) */}
        <div className="hidden 5xl:block font-bold text-6xl">5xl</div>
      </div>
    </div>
  )
}
