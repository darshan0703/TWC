import React, { useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useKiosk } from './context/KioskContext';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { MobileNumberScreen } from './screens/MobileNumberScreen';
import { MainCategoryScreen } from './screens/MainCategoryScreen';
import { MenuScreen } from './screens/MenuScreen';
import { CustomizationScreen } from './screens/CustomizationScreen';
import { CartScreen } from './screens/CartScreen';
import { WalletTopUpScreen } from './screens/WalletTopUpScreen';
import { OrderConfirmedGuard, WalletSuccessGuard } from './components/RouteGuards';
import { ToastNotification } from './components/ToastNotification';
import { VoiceBaristaWidget } from './components/VoiceBaristaWidget';
import { Monitor, ChevronDown, ChevronUp } from 'lucide-react';

export const App = () => {
  const { currentScreen, navigateTo, openCategory } = useKiosk();
  const location = useLocation();
  const [showKioskNav, setShowKioskNav] = useState(false);

  // Quick navigation items for easy evaluation of all screens
  const SCREENS_LIST = [
    { id: 'welcome', route: '/welcome', label: '1. Welcome / Touch to Start', action: () => navigateTo('/welcome') },
    { id: 'mobile', route: '/mobile', label: '2. Enter Mobile Number', action: () => navigateTo('/mobile') },
    { id: 'categories', route: '/categories', label: '3. Main Categories (4 Primary)', action: () => navigateTo('/categories') },
    { id: 'menu_coffee', route: '/menu', label: '4. Menu — Coffee', action: () => openCategory('coffee') },
    { id: 'menu_beverages', route: '/menu', label: '5. Menu — Beverages', action: () => openCategory('beverages') },
    { id: 'menu_food', route: '/menu', label: '6. Menu — Food', action: () => openCategory('food') },
    { id: 'menu_specials', route: '/menu', label: '7. Menu — Specials', action: () => openCategory('specials') },
    { id: 'customization', route: '/customization', label: '8. Product Customization', action: () => navigateTo('/customization') },
    { id: 'cart', route: '/cart', label: '9. Cart & Bill Summary', action: () => navigateTo('/cart') },
    { id: 'wallet_topup', route: '/wallet-topup', label: '10. Wallet Top-Up (Demo QR)', action: () => navigateTo('/wallet-topup') },
    { id: 'wallet_success', route: '/wallet-success', label: '11. Wallet Payment Success', action: () => navigateTo('/wallet-success') },
    { id: 'order_confirmed', route: '/order-confirmed', label: '12. Order Confirmation', action: () => navigateTo('/order-confirmed') },
  ];

  return (
    <div className="w-screen h-screen h-[100dvh] bg-[#0c0c0c] text-navy font-sans antialiased flex items-center justify-center select-none relative overflow-hidden">
      {/* STRICT 9:16 PORTRAIT KIOSK FRAME (Burger King Style Architecture) */}
      <div className={`relative w-[min(100vw,calc(100dvh*9/16))] h-[min(100dvh,calc(100vw*16/9))] aspect-[9/16] ${currentScreen === 'welcome' ? 'bg-[#1C2A39]' : 'bg-cream-100'} flex flex-col overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.85)]`}>
        {/* Active Kiosk Screen Container driven by React Router SPA Routes */}
        <main className={`relative w-full h-full flex flex-col overflow-hidden ${currentScreen === 'welcome' ? 'bg-[#1C2A39]' : 'bg-cream-100'}`}>
          <Routes>
            <Route path="/" element={<Navigate to="/welcome" replace />} />
            <Route path="/welcome" element={<WelcomeScreen />} />
            <Route path="/mobile" element={<MobileNumberScreen />} />
            <Route path="/categories" element={<MainCategoryScreen />} />
            <Route path="/menu" element={<MenuScreen />} />
            <Route path="/customization" element={<CustomizationScreen />} />
            <Route path="/cart" element={<CartScreen />} />
            <Route path="/wallet-topup" element={<WalletTopUpScreen />} />
            <Route path="/wallet-success" element={<WalletSuccessGuard />} />
            <Route path="/order-confirmed" element={<OrderConfirmedGuard />} />
            <Route path="*" element={<Navigate to="/welcome" replace />} />
          </Routes>
        </main>

        {/* AI Voice Barista Conversational Companion (Active across ordering screens) */}
        <VoiceBaristaWidget />

        {/* Floating Global Toast Notification */}
        <ToastNotification />
      </div>

      {/* Screen Navigation Jump Bar (Subtle developer tool - strictly hidden on welcome screen) */}
      {currentScreen !== 'welcome' && (
        <aside className="fixed bottom-3 left-3 z-50 select-none opacity-40 hover:opacity-100 transition-opacity">
          <div className="bg-navy/95 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-white/15 overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => setShowKioskNav(!showKioskNav)}
              className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white/80 hover:text-white transition-colors"
            >
              <Monitor className="w-3.5 h-3.5 text-white" />
              <span>Screen Jump</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-0.5" />
              {showKioskNav ? (
                <ChevronDown className="w-3 h-3 ml-0.5" />
              ) : (
                <ChevronUp className="w-3 h-3 ml-0.5" />
              )}
            </button>

            {showKioskNav && (
              <div className="p-2 border-t border-white/15 flex flex-col gap-1 max-h-72 overflow-y-auto w-64 text-left">
                <span className="text-[9px] font-black uppercase tracking-widest text-beige-muted px-2 py-0.5">
                  Direct Screen Jump
                </span>
                {SCREENS_LIST.map((item) => {
                  const isActive = location.pathname === item.route;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        item.action();
                        setShowKioskNav(false);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold text-left transition-all ${
                        isActive
                          ? 'bg-white text-navy font-black shadow-sm'
                          : 'text-white/80 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
};
