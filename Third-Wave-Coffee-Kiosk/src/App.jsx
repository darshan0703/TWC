import React, { useState } from 'react';
import { useKiosk } from './context/KioskContext';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { MobileNumberScreen } from './screens/MobileNumberScreen';
import { MainCategoryScreen } from './screens/MainCategoryScreen';
import { MenuScreen } from './screens/MenuScreen';
import { CustomizationScreen } from './screens/CustomizationScreen';
import { CartScreen } from './screens/CartScreen';
import { WalletTopUpScreen } from './screens/WalletTopUpScreen';
import { WalletSuccessScreen } from './screens/WalletSuccessScreen';
import { OrderConfirmationScreen } from './screens/OrderConfirmationScreen';
import { ToastNotification } from './components/ToastNotification';
import { VoiceBaristaWidget } from './components/VoiceBaristaWidget';
import { Monitor, ChevronDown, ChevronUp, Maximize2 } from 'lucide-react';

export const App = () => {
  const { currentScreen, setCurrentScreen, openCategory, setActiveCategory } = useKiosk();
  const [showKioskNav, setShowKioskNav] = useState(false);
  const [fullHeightMode, setFullHeightMode] = useState(false);

  // Quick navigation items for easy evaluation of all screens
  const SCREENS_LIST = [
    { id: 'welcome', label: '1. Welcome / Touch to Start', action: () => setCurrentScreen('welcome') },
    { id: 'mobile', label: '2. Enter Mobile Number', action: () => setCurrentScreen('mobile') },
    { id: 'categories', label: '3. Main Categories (4 Primary)', action: () => setCurrentScreen('categories') },
    { id: 'menu_coffee', label: '4. Menu — Coffee', action: () => openCategory('coffee') },
    { id: 'menu_beverages', label: '5. Menu — Beverages', action: () => openCategory('beverages') },
    { id: 'menu_food', label: '6. Menu — Food', action: () => openCategory('food') },
    { id: 'menu_specials', label: '7. Menu — Specials', action: () => openCategory('specials') },
    { id: 'customization', label: '8. Product Customization', action: () => setCurrentScreen('customization') },
    { id: 'cart', label: '9. Cart & Bill Summary', action: () => setCurrentScreen('cart') },
    { id: 'wallet_topup', label: '10. Wallet Top-Up (Demo QR)', action: () => setCurrentScreen('wallet_topup') },
    { id: 'wallet_success', label: '11. Wallet Payment Success', action: () => setCurrentScreen('wallet_success') },
    { id: 'order_confirmed', label: '12. Order Confirmation', action: () => setCurrentScreen('order_confirmed') },
  ];

  const renderCurrentScreen = () => {
    switch (currentScreen) {
      case 'welcome':
        return <WelcomeScreen />;
      case 'mobile':
        return <MobileNumberScreen />;
      case 'categories':
        return <MainCategoryScreen />;
      case 'menu':
        return <MenuScreen />;
      case 'customization':
        return <CustomizationScreen />;
      case 'cart':
        return <CartScreen />;
      case 'wallet_topup':
        return <WalletTopUpScreen />;
      case 'wallet_success':
        return <WalletSuccessScreen />;
      case 'order_confirmed':
        return <OrderConfirmationScreen />;
      default:
        return <WelcomeScreen />;
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#141414] text-navy font-sans antialiased flex flex-col items-center justify-center p-2 sm:p-4 select-none relative overflow-x-hidden">
      
      {/* Kiosk Status Indicator / Subtitle Bar outside the Canvas */}
      <div className="w-full max-w-lg mx-auto flex items-center justify-between px-3 py-1.5 mb-1.5 text-[11px] font-extrabold uppercase tracking-widest text-[#9E948A] shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Third Wave Coffee Kiosk</span>
          <span className="text-white/20">•</span>
          <span className="text-white/80 font-bold">1080 × 1920 (9:16 Portrait)</span>
        </div>

        <button
          type="button"
          onClick={() => setFullHeightMode(!fullHeightMode)}
          className="hover:text-white transition-colors flex items-center gap-1 text-[10px]"
          title="Toggle Canvas Scale"
        >
          <Maximize2 className="w-3 h-3 text-white/80" />
          <span>{fullHeightMode ? 'Fit View' : 'Max Scale'}</span>
        </button>
      </div>

      {/* FIXED 9:16 PORTRAIT KIOSK CANVAS (1080 x 1920 Reference) */}
      <div
        className={`relative aspect-[9/16] ${
          fullHeightMode 
            ? 'h-[98vh] w-[calc(98vh*9/16)]' 
            : 'h-[min(94vh,calc(100vw*16/9))] w-[min(calc(94vh*9/16),98vw)]'
        } max-w-[620px] bg-cream-100 rounded-[28px] sm:rounded-[36px] border border-[#2A2A2A] ring-1 ring-white/10 shadow-[0_25px_80px_rgba(0,0,0,0.85),0_10px_35px_rgba(0,0,0,0.7)] flex flex-col overflow-hidden transition-all duration-300`}
      >
        {/* Active Kiosk Screen */}
        <div className="relative w-full h-full flex flex-col overflow-hidden bg-cream-100">
          {renderCurrentScreen()}
        </div>

        {/* AI Voice Barista Conversational Companion */}
        <VoiceBaristaWidget />

        {/* Floating Global Toast Notification inside Kiosk Canvas */}
        <ToastNotification />
      </div>

      {/* Evaluator / Kiosk Screen Jump Bar (collapsible pill placed in bottom-left outside canvas) */}
      <aside className="fixed bottom-3 left-3 z-50 select-none">
        <div className="bg-navy/95 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-white/15 overflow-hidden transition-all">
          
          <button
            type="button"
            onClick={() => setShowKioskNav(!showKioskNav)}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-white/80 hover:text-white transition-colors"
          >
            <Monitor className="w-3.5 h-3.5 text-white" />
            <span>Screen Jump</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-0.5" />
            {showKioskNav ? (
              <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5 ml-0.5" />
            )}
          </button>

          {showKioskNav && (
            <div className="p-2.5 border-t border-white/15 flex flex-col gap-1 max-h-72 overflow-y-auto w-64 text-left">
              <span className="text-[9px] font-black uppercase tracking-widest text-beige-muted px-2 py-0.5">
                Direct Screen Jump
              </span>
              {SCREENS_LIST.map((item) => {
                const isActive = currentScreen === item.id;

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

    </div>
  );
};
