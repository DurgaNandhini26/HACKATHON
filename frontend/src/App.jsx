import { useState, useMemo } from 'react';

// --- MOCK DATA ---
const activeRentalsData = [
  { equipmentID: 'EQ-8842', type: 'Excavator', siteID: 'ST-01', checkInDate: '2026-07-20', checkOutDate: null, engineHours: 6.5, idleHours: 1.2, rentalDays: 26, operatorID: 'OP-102', location: 'North Wing' },
  { equipmentID: 'EQ-3310', type: 'Loader', siteID: 'ST-03', checkInDate: '2026-07-10', checkOutDate: null, engineHours: 7.1, idleHours: 2.0, rentalDays: 21, operatorID: 'OP-102', location: 'South Pit' },
  { equipmentID: 'EQ-7777', type: 'Dump Truck', siteID: 'ST-04', checkInDate: '2026-07-01', checkOutDate: null, engineHours: 12.4, idleHours: 4.1, rentalDays: 24, operatorID: 'OP-089', location: 'West Gate' },
];

const rentalHistoryData = [
  { equipmentID: 'EQ-9921', type: 'Bulldozer', siteID: 'ST-02', checkInDate: '2026-07-25', checkOutDate: '2026-07-30', engineHours: 8.0, idleHours: 0.5, operatorID: 'OP-044', location: 'East Sector' },
  { equipmentID: 'EQ-1045', type: 'Crane', siteID: 'ST-01', checkInDate: '2026-06-15', checkOutDate: '2026-07-10', engineHours: 42.2, idleHours: 13.5, operatorID: 'OP-201', location: 'Main Hub' },
  { equipmentID: 'EQ-5522', type: 'Skid Steer', siteID: 'ST-01', checkInDate: '2026-05-10', checkOutDate: '2026-05-18', engineHours: 18.4, idleHours: 2.1, operatorID: 'OP-102', location: 'North Wing' },
  // Duplicate equipment entry example to verify aggregation behavior
  { equipmentID: 'EQ-9921', type: 'Bulldozer', siteID: 'ST-01', checkInDate: '2026-06-01', checkOutDate: '2026-06-05', engineHours: 10.0, idleHours: 1.0, operatorID: 'OP-044', location: 'North Hub' },
];

export default function EquipmentDashboard() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('active'); // 'active', 'history', 'siteUsage', or 'rentalHours'

  // --- LOGIC: Active Rentals ---
  const { processedActiveData, overdueItems } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); 

    const activeWithDays = activeRentalsData.map(item => {
      const checkIn = new Date(item.checkInDate);
      const expectedReturn = new Date(checkIn);
      expectedReturn.setDate(expectedReturn.getDate() + item.rentalDays);

      const diffTime = expectedReturn.getTime() - today.getTime();
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      return { 
        ...item, 
        daysRemaining, 
        expectedReturnDate: expectedReturn.toISOString().split('T')[0] 
      };
    });

    const overdues = activeWithDays.filter(item => item.daysRemaining < 0);
    return { processedActiveData: activeWithDays, overdueItems: overdues };
  }, []);

  // --- LOGIC: Rental History ---
  const processedHistoryData = useMemo(() => {
    return rentalHistoryData.map(item => {
      const checkIn = new Date(item.checkInDate);
      const checkOut = new Date(item.checkOutDate);
      const diffTime = checkOut.getTime() - checkIn.getTime();
      const totalRentedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return { ...item, totalRentedDays };
    }).sort((a, b) => new Date(b.checkOutDate) - new Date(a.checkOutDate));
  }, []);

  // --- LOGIC: Usage Per Site Aggregation ---
  const siteUsageData = useMemo(() => {
    const combined = [...processedActiveData, ...rentalHistoryData];
    const map = {};

    combined.forEach(item => {
      if (!map[item.siteID]) {
        map[item.siteID] = {
          siteID: item.siteID,
          activeEquipmentCount: 0,
          totalEngineHours: 0,
          totalIdleHours: 0,
          equipmentList: new Set()
        };
      }
      map[item.siteID].totalEngineHours += Number(item.engineHours || 0);
      map[item.siteID].totalIdleHours += Number(item.idleHours || 0);
      map[item.siteID].equipmentList.add(item.equipmentID);

      if (!item.checkOutDate) {
        map[item.siteID].activeEquipmentCount += 1;
      }
    });

    return Object.values(map).map(site => ({
      ...site,
      uniqueEquipmentCount: site.equipmentList.size,
      efficiencyRatio: site.totalEngineHours > 0 
        ? ((site.totalEngineHours / (site.totalEngineHours + site.totalIdleHours)) * 100).toFixed(1) 
        : '0.0'
    })).sort((a, b) => b.totalEngineHours - a.totalEngineHours);
  }, [processedActiveData]);

  // --- LOGIC: Rental Hours Aggregation per Equipment ---
  const rentalHoursData = useMemo(() => {
    const combined = [...processedActiveData, ...processedHistoryData];
    const map = {};

    combined.forEach(item => {
      const days = item.totalRentedDays || item.rentalDays || 1;
      if (!map[item.equipmentID]) {
        map[item.equipmentID] = {
          equipmentID: item.equipmentID,
          type: item.type,
          totalDays: 0,
          entriesCount: 0
        };
      }
      map[item.equipmentID].totalDays += days;
      map[item.equipmentID].entriesCount += 1;
    });

    return Object.values(map).map(eq => ({
      ...eq,
      totalRentalHours: eq.totalDays * 24
    })).sort((a, b) => b.totalRentalHours - a.totalRentalHours);
  }, [processedActiveData, processedHistoryData]);

  const overdueCount = overdueItems.length;

  // Choose data source based on tab
  const currentData = activeTab === 'active' 
    ? processedActiveData 
    : activeTab === 'history' 
    ? processedHistoryData 
    : activeTab === 'siteUsage'
    ? siteUsageData
    : rentalHoursData;

  // --- Apply Search Filter THEN Sort ---
  const filteredAndSortedData = useMemo(() => {
    let filtered = currentData.filter(item => {
      if (!searchTerm) return true;
      return Object.values(item).some(val => 
        String(val).toLowerCase().includes(searchTerm.toLowerCase())
      );
    });

    if (activeTab === 'active') {
      filtered = filtered.sort((a, b) => {
        if (a.daysRemaining < 0 && b.daysRemaining >= 0) return -1;
        if (b.daysRemaining < 0 && a.daysRemaining >= 0) return 1;
        return a.daysRemaining - b.daysRemaining;
      });
    }

    return filtered;
  }, [currentData, searchTerm, activeTab]);

  return (
    <div className="min-h-screen flex flex-col font-sans bg-gray-100 overflow-hidden relative">
      
      {/* Solid Industrial Header */}
      <header className="bg-white border-b-[8px] border-[#FFCC00] px-8 py-6 flex items-center justify-between shadow-md relative z-20">
        <div>
          <h1 className="text-4xl font-black text-black uppercase tracking-tighter">
            Rental Tracker
          </h1>
          <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mt-1">
            Active Equipment Tracking System
          </p>
        </div>

        {/* Notification Bell */}
        <div className="flex items-center gap-6">
          <button 
            onClick={() => setIsPanelOpen(true)}
            className="relative p-3 rounded-full bg-gray-100 border-2 border-gray-200 shadow-sm hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-[#FFCC00]"
          >
            <svg className="w-6 h-6 text-black" fill="none" strokeWidth="2" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
            
            {overdueCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-100"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-red-600 border-2 border-white text-[9px] text-white font-bold flex items-center justify-center">
                  {overdueCount}
                </span>
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative flex-1 bg-gray-200">
        
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center bg-fixed opacity-75"
          style={{ backgroundImage: 'url("https://heavyequipmentcollege.edu/wp-content/uploads/2021/09/how-to-operate-excavator-scaled-1.jpg")' }}
        ></div>

        <div className="relative z-10 p-8 h-full flex flex-col">
          
          {/* Tab Navigation */}
          <div className="flex flex-wrap gap-2 mb-2">
            <button 
              onClick={() => setActiveTab('active')}
              className={`px-6 py-3 text-sm font-bold uppercase tracking-wider transition-colors border-t-4 shadow-sm ${
                activeTab === 'active' 
                ? 'bg-white/90 text-black border-[#FFCC00]' 
                : 'bg-black/60 text-white border-transparent hover:bg-black/80 backdrop-blur-sm'
              }`}
            >
              Active Rentals
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`px-6 py-3 text-sm font-bold uppercase tracking-wider transition-colors border-t-4 shadow-sm ${
                activeTab === 'history' 
                ? 'bg-white/90 text-black border-[#FFCC00]' 
                : 'bg-black/60 text-white border-transparent hover:bg-black/80 backdrop-blur-sm'
              }`}
            >
              Rental History
            </button>
            <button 
              onClick={() => setActiveTab('siteUsage')}
              className={`px-6 py-3 text-sm font-bold uppercase tracking-wider transition-colors border-t-4 shadow-sm ${
                activeTab === 'siteUsage' 
                ? 'bg-white/90 text-black border-[#FFCC00]' 
                : 'bg-black/60 text-white border-transparent hover:bg-black/80 backdrop-blur-sm'
              }`}
            >
              Usage Per Site
            </button>
            <button 
              onClick={() => setActiveTab('rentalHours')}
              className={`px-6 py-3 text-sm font-bold uppercase tracking-wider transition-colors border-t-4 shadow-sm ${
                activeTab === 'rentalHours' 
                ? 'bg-white/90 text-black border-[#FFCC00]' 
                : 'bg-black/60 text-white border-transparent hover:bg-black/80 backdrop-blur-sm'
              }`}
            >
              Rental Hours
            </button>
          </div>

          <div className="bg-white/85 backdrop-blur-sm shadow-2xl overflow-hidden border border-gray-300/50">
            
            {/* Toolbar with Search */}
            <div className="bg-white/40 p-4 border-b border-gray-300/50 flex justify-between items-center">
              <div className="relative w-96">
                <input 
                  type="text" 
                  placeholder={`Search ${activeTab === 'rentalHours' ? 'rental hours' : activeTab === 'siteUsage' ? 'site usage' : activeTab} records...`} 
                  className="w-full pl-4 pr-10 py-2 text-black bg-white/90 border-2 border-gray-400/50 focus:outline-none focus:border-black transition-colors font-semibold placeholder-gray-500 shadow-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <svg className="w-5 h-5 text-black absolute right-3 top-2.5 font-bold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              
              <div className="text-sm font-bold text-gray-700 uppercase tracking-wider flex gap-4">
                {activeTab === 'active' && overdueCount > 0 && <span className="text-red-600">{overdueCount} Overdue</span>}
                <span>{filteredAndSortedData.length} Records Found</span>
              </div>
            </div>

            {/* Data Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-max">
                <thead>
                  <tr className="bg-black border-b-4 border-[#FFCC00]">
                    {activeTab === 'siteUsage' ? (
                      <>
                        <th className="p-4 text-[#FFCC00] uppercase text-xs font-bold tracking-wider border-r border-gray-700">Site ID</th>
                        <th className="p-4 text-[#FFCC00] uppercase text-xs font-bold tracking-wider border-r border-gray-700 text-center">Active Units</th>
                        <th className="p-4 text-[#FFCC00] uppercase text-xs font-bold tracking-wider border-r border-gray-700 text-center">Total Eng. Hrs</th>
                        <th className="p-4 text-[#FFCC00] uppercase text-xs font-bold tracking-wider border-r border-gray-700 text-center">Total Idle Hrs</th>
                        <th className="p-4 text-[#FFCC00] uppercase text-xs font-bold tracking-wider text-center">Operational Efficiency</th>
                      </>
                    ) : activeTab === 'rentalHours' ? (
                      <>
                        <th className="p-4 text-[#FFCC00] uppercase text-xs font-bold tracking-wider border-r border-gray-700">Eq. ID</th>
                        <th className="p-4 text-[#FFCC00] uppercase text-xs font-bold tracking-wider border-r border-gray-700">Type</th>
                        <th className="p-4 text-[#FFCC00] uppercase text-xs font-bold tracking-wider border-r border-gray-700 text-center">Total Entries</th>
                        <th className="p-4 text-[#FFCC00] uppercase text-xs font-bold tracking-wider border-r border-gray-700 text-center">Total Rented Days</th>
                        <th className="p-4 text-[#FFCC00] uppercase text-xs font-bold tracking-wider text-center">Total Rental Hours (Days × 24)</th>
                      </>
                    ) : (
                      <>
                        <th className="p-4 text-[#FFCC00] uppercase text-xs font-bold tracking-wider border-r border-gray-700">Eq. ID</th>
                        <th className="p-4 text-[#FFCC00] uppercase text-xs font-bold tracking-wider border-r border-gray-700">Type</th>
                        <th className="p-4 text-[#FFCC00] uppercase text-xs font-bold tracking-wider border-r border-gray-700">Site ID</th>
                        <th className="p-4 text-[#FFCC00] uppercase text-xs font-bold tracking-wider border-r border-gray-700">Check-In</th>
                        
                        {activeTab === 'active' ? (
                          <th className="p-4 text-[#FFCC00] uppercase text-xs font-bold tracking-wider border-r border-gray-700">Status</th>
                        ) : (
                          <>
                            <th className="p-4 text-[#FFCC00] uppercase text-xs font-bold tracking-wider border-r border-gray-700">Check-Out</th>
                            <th className="p-4 text-[#FFCC00] uppercase text-xs font-bold tracking-wider border-r border-gray-700 text-center">Total Days</th>
                          </>
                        )}
                        
                        <th className="p-4 text-[#FFCC00] uppercase text-xs font-bold tracking-wider border-r border-gray-700 text-center">Eng. Hrs</th>
                        <th className="p-4 text-[#FFCC00] uppercase text-xs font-bold tracking-wider border-r border-gray-700 text-center">Idle Hrs</th>
                        <th className="p-4 text-[#FFCC00] uppercase text-xs font-bold tracking-wider border-r border-gray-700">Operator</th>
                        <th className="p-4 text-[#FFCC00] uppercase text-xs font-bold tracking-wider">Location</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-300/50 text-sm">
                  {activeTab === 'siteUsage' ? (
                    filteredAndSortedData.map((site, index) => (
                      <tr key={index} className="hover:bg-yellow-50/60 transition-colors">
                        <td className="p-4 font-black text-gray-900 border-r border-gray-300/50">{site.siteID}</td>
                        <td className="p-4 text-center border-r border-gray-300/50">
                          <span className="bg-black/5 text-gray-800 px-2.5 py-1 font-semibold rounded-sm">{site.activeEquipmentCount}</span>
                        </td>
                        <td className="p-4 text-center border-r border-gray-300/50">
                          <span className="bg-black/5 text-gray-800 px-2.5 py-1 font-semibold rounded-sm">{site.totalEngineHours.toFixed(1)}</span>
                        </td>
                        <td className="p-4 text-center border-r border-gray-300/50">
                          <span className="bg-black/5 text-gray-800 px-2.5 py-1 font-semibold rounded-sm">{site.totalIdleHours.toFixed(1)}</span>
                        </td>
                        <td className="p-4 text-center font-bold text-gray-900">
                          <span className="bg-yellow-100 text-yellow-900 px-3 py-1 rounded-sm border border-yellow-300">
                            {site.efficiencyRatio}% Active
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : activeTab === 'rentalHours' ? (
                    filteredAndSortedData.map((eq, index) => (
                      <tr key={index} className="hover:bg-yellow-50/60 transition-colors">
                        <td className="p-4 font-black text-gray-900 border-r border-gray-300/50">{eq.equipmentID}</td>
                        <td className="p-4 font-medium text-gray-800 border-r border-gray-300/50">{eq.type}</td>
                        <td className="p-4 text-center border-r border-gray-300/50">
                          <span className="bg-black/5 text-gray-800 px-2.5 py-1 font-semibold rounded-sm">{eq.entriesCount}</span>
                        </td>
                        <td className="p-4 text-center border-r border-gray-300/50">
                          <span className="bg-black/5 text-gray-800 px-2.5 py-1 font-semibold rounded-sm">{eq.totalDays} Days</span>
                        </td>
                        <td className="p-4 text-center font-bold text-gray-900">
                          <span className="bg-[#FFCC00]/25 text-black px-3 py-1 rounded-sm border border-[#FFCC00]">
                            {eq.totalRentalHours} Hours
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    filteredAndSortedData.map((row, index) => {
                      const isOverdue = activeTab === 'active' && row.daysRemaining < 0;
                      const isEndingSoon = activeTab === 'active' && row.daysRemaining >= 0 && row.daysRemaining <= 5;

                      return (
                        <tr 
                          key={index} 
                          className={`transition-colors ${
                            isOverdue ? 'bg-red-500/10 hover:bg-red-500/20' : 'hover:bg-yellow-50/60'
                          }`}
                        >
                          <td className="p-4 font-semibold text-gray-900 border-r border-gray-300/50">{row.equipmentID}</td>
                          <td className="p-4 font-medium text-gray-800 border-r border-gray-300/50">{row.type}</td>
                          <td className="p-4 text-gray-700 border-r border-gray-300/50">{row.siteID}</td>
                          <td className="p-4 text-gray-700 border-r border-gray-300/50">{row.checkInDate}</td>
                          
                          {activeTab === 'active' ? (
                            <td className="p-4 border-r border-gray-300/50 font-semibold">
                              {isOverdue && (
                                <span className="text-red-700 bg-red-100 px-2 py-1 rounded-sm flex items-center gap-1 w-max shadow-sm">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                  OVERDUE ({Math.abs(row.daysRemaining)}D)
                                </span>
                              )}
                              {isEndingSoon && (
                                <span className="text-black px-2 py-1 rounded-sm flex items-center gap-1 w-max shadow-sm" style={{ backgroundColor: '#FFCC00' }}>
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                  ENDS IN {row.daysRemaining}D
                                </span>
                              )}
                              {!isOverdue && !isEndingSoon && (
                                <span className="text-gray-600 bg-white/50 px-2 py-1 rounded-sm shadow-sm border border-gray-200/50">
                                  {row.daysRemaining} Days Left
                                </span>
                              )}
                            </td>
                          ) : (
                            <>
                              <td className="p-4 text-gray-700 border-r border-gray-300/50">{row.checkOutDate}</td>
                              <td className="p-4 text-center border-r border-gray-300/50">
                                <span className="bg-white/50 text-gray-800 px-2 py-1 font-semibold rounded-sm shadow-sm border border-gray-200/50">
                                  {row.totalRentedDays}
                                </span>
                              </td>
                            </>
                          )}

                          <td className="p-4 text-center border-r border-gray-300/50">
                            <span className="bg-black/5 text-gray-800 px-2 py-1 font-semibold rounded-sm">{row.engineHours}</span>
                          </td>
                          <td className="p-4 text-center border-r border-gray-300/50">
                            <span className="bg-black/5 text-gray-800 px-2 py-1 font-semibold rounded-sm">{row.idleHours}</span>
                          </td>
                          
                          <td className="p-4 text-gray-700 border-r border-gray-300/50">{row.operatorID}</td>
                          <td className="p-4 font-semibold text-gray-900">{row.location}</td>
                        </tr>
                      );
                    })
                  )}
                  
                  {filteredAndSortedData.length === 0 && (
                    <tr>
                      <td colSpan={activeTab === 'siteUsage' || activeTab === 'rentalHours' ? 5 : activeTab === 'active' ? 10 : 11} className="p-12 text-center text-gray-700 font-bold uppercase tracking-wider">
                        No {activeTab === 'rentalHours' ? 'rental hours' : activeTab === 'siteUsage' ? 'site usage' : activeTab} records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
          </div>
        </div>
      </main>

      {/* --- SIDE PANEL OVERLAY --- */}
      {isPanelOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 transition-opacity backdrop-blur-sm"
          onClick={() => setIsPanelOpen(false)}
        ></div>
      )}

      {/* --- NOTIFICATION SIDE PANEL --- */}
      <div 
        className={`fixed top-0 right-0 h-full w-96 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out border-l-[8px] border-red-600 flex flex-col ${
          isPanelOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="bg-gray-100 p-6 border-b border-gray-300 flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-2">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h2 className="text-xl font-black uppercase text-red-700 tracking-tighter">
              Overdue Alerts
            </h2>
          </div>
          <button 
            onClick={() => setIsPanelOpen(false)}
            className="text-gray-500 hover:text-black hover:bg-gray-200 p-1.5 rounded-full transition-colors focus:outline-none"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto bg-gray-50 space-y-4">
          {overdueCount === 0 ? (
            <div className="text-center text-gray-500 font-bold uppercase tracking-wider mt-10">
              <svg className="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              No overdue equipment!
            </div>
          ) : (
            overdueItems.map(item => (
              <div key={item.equipmentID} className="bg-white p-4 rounded-md border border-red-200 shadow-sm border-l-4 border-l-red-500">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-black text-lg text-black">{item.equipmentID}</span>
                  <span className="text-red-700 font-bold text-xs bg-red-100 px-2 py-1 rounded-sm">
                    {Math.abs(item.daysRemaining)} DAYS LATE
                  </span>
                </div>
                <div className="text-sm font-semibold text-gray-700 mb-1">{item.type}</div>
                
                <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-gray-600">
                  <div>
                    <span className="block text-gray-400 font-bold uppercase">Site</span>
                    <span className="font-semibold text-black">{item.siteID}</span>
                  </div>
                  <div>
                    <span className="block text-gray-400 font-bold uppercase">Operator</span>
                    <span className="font-semibold text-black">{item.operatorID}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="block text-gray-400 font-bold uppercase">Expected Return</span>
                    <span className="font-semibold text-black">{item.expectedReturnDate}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="block text-gray-400 font-bold uppercase">Location</span>
                    <span className="font-semibold text-black">{item.location}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}