import React, { createContext, useContext, useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MAIN_CATEGORIES, PRODUCTS, CUSTOMIZATION_OPTIONS } from '../data/products';

export const SCREEN_TO_ROUTE = {
  welcome: '/welcome',
  '/welcome': '/welcome',
  mobile: '/mobile',
  '/mobile': '/mobile',
  categories: '/categories',
  '/categories': '/categories',
  menu: '/menu',
  '/menu': '/menu',
  customization: '/customization',
  '/customization': '/customization',
  cart: '/cart',
  '/cart': '/cart',
  wallet_topup: '/wallet-topup',
  'wallet-topup': '/wallet-topup',
  '/wallet-topup': '/wallet-topup',
  '/wallet_topup': '/wallet-topup',
  wallet_success: '/wallet-success',
  'wallet-success': '/wallet-success',
  '/wallet-success': '/wallet-success',
  '/wallet_success': '/wallet-success',
  order_confirmed: '/order-confirmed',
  'order-confirmed': '/order-confirmed',
  '/order-confirmed': '/order-confirmed',
  '/order_confirmed': '/order-confirmed',
};

export const ROUTE_TO_SCREEN = {
  '/welcome': 'welcome',
  '/mobile': 'mobile',
  '/categories': 'categories',
  '/menu': 'menu',
  '/customization': 'customization',
  '/cart': 'cart',
  '/wallet-topup': 'wallet_topup',
  '/wallet_topup': 'wallet_topup',
  '/wallet-success': 'wallet_success',
  '/wallet_success': 'wallet_success',
  '/order-confirmed': 'order_confirmed',
  '/order_confirmed': 'order_confirmed',
};

const loadStorage = (key, fallback) => {
  try {
    const raw = sessionStorage.getItem(`twc_${key}`);
    if (raw === null || raw === undefined) return fallback;
    const parsed = JSON.parse(raw);
    // Sanitize any stale demo cart records so new sessions start completely clean
    if (key === 'cart' && Array.isArray(parsed)) {
      const hasDemoItems = parsed.some(item => item.cartId === 'item-demo-1' || item.cartId === 'item-demo-2');
      if (hasDemoItems) {
        sessionStorage.removeItem('twc_cart');
        return fallback;
      }
    }
    return parsed;
  } catch (_) {
    return fallback;
  }
};

const saveStorage = (key, value) => {
  try {
    if (value === null || value === undefined) {
      sessionStorage.removeItem(`twc_${key}`);
    } else {
      sessionStorage.setItem(`twc_${key}`, JSON.stringify(value));
    }
  } catch (_) {
    // Ignore quota or disabled storage
  }
};

const KioskContext = createContext(null);

export const KioskProvider = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Derive currentScreen directly from route pathname
  const currentScreen = useMemo(() => {
    return ROUTE_TO_SCREEN[location.pathname] || 'welcome';
  }, [location.pathname]);

  // Session / Order Mode
  const [orderType, setOrderType] = useState(() => loadStorage('orderType', 'dine_in'));
  // Canonical phone number rendered directly from backend session state (never persisted in browser storage)
  const [mobileNumber, setMobileNumber] = useState('');

  // 4 Primary Menu Categories: 'coffee' | 'beverages' | 'food' | 'specials'
  const [selectedMainCategory, setSelectedMainCategory] = useState(() => loadStorage('selectedMainCategory', 'coffee'));
  // Subcategory active in Menu (e.g. 'coffee_classics', 'coffee_twc_specials', etc.)
  const [selectedSubcategory, setSelectedSubcategory] = useState(() => loadStorage('selectedSubcategory', 'coffee_classics'));
  
  // Customization selection
  const [selectedProduct, setSelectedProduct] = useState(() => loadStorage('selectedProduct', null));

  // Cart: clean empty initial state for kiosk customer (0 items, ₹0 total)
  const [cart, setCart] = useState(() => loadStorage('cart', []));

  // Wallet
  const [walletBalance, setWalletBalance] = useState(() => loadStorage('walletBalance', 450));
  const [selectedTopupAmount, setSelectedTopupAmount] = useState(600);
  const [customTopupInput, setCustomTopupInput] = useState('');
  const [lastTopupAmount, setLastTopupAmount] = useState(() => loadStorage('lastTopupAmount', null));

  // Order Details
  const [lastOrder, setLastOrder] = useState(() => loadStorage('lastOrder', null));

  // Toast Notification
  const [toast, setToast] = useState({ show: false, message: '', actionText: '', onAction: null });

  // Sync state changes to sessionStorage (PII / phone numbers are strictly excluded)
  useEffect(() => { saveStorage('orderType', orderType); }, [orderType]);
  useEffect(() => { saveStorage('selectedMainCategory', selectedMainCategory); }, [selectedMainCategory]);
  useEffect(() => { saveStorage('selectedSubcategory', selectedSubcategory); }, [selectedSubcategory]);
  useEffect(() => { saveStorage('selectedProduct', selectedProduct); }, [selectedProduct]);
  useEffect(() => { saveStorage('cart', cart); }, [cart]);
  useEffect(() => { saveStorage('walletBalance', walletBalance); }, [walletBalance]);
  useEffect(() => { saveStorage('lastTopupAmount', lastTopupAmount); }, [lastTopupAmount]);
  useEffect(() => { saveStorage('lastOrder', lastOrder); }, [lastOrder]);

  const showToast = useCallback((message, actionText = '', onAction = null) => {
    setToast({ show: true, message, actionText, onAction });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 3800);
  }, []);

  const hideToast = useCallback(() => {
    setToast(prev => ({ ...prev, show: false }));
  }, []);

  // Centralized Navigation Handler
  const navigateTo = useCallback((screenOrRoute, replace = false) => {
    const targetRoute = SCREEN_TO_ROUTE[screenOrRoute] || (screenOrRoute.startsWith('/') ? screenOrRoute : `/${screenOrRoute}`);
    
    // Avoid duplicate history entries for repeated navigation to the same route
    if (location.pathname === targetRoute) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    navigate(targetRoute, { replace });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.pathname, navigate]);

  // Backwards-compatible alias for legacy calls
  const setCurrentScreen = useCallback((screen) => {
    navigateTo(screen);
  }, [navigateTo]);

  // Predictable Back Navigation
  const goBack = useCallback(() => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      // Predictable fallback route map
      const fallbackRoutes = {
        '/order-confirmed': '/welcome',
        '/wallet-success': '/cart',
        '/wallet-topup': '/cart',
        '/cart': '/menu',
        '/customization': '/menu',
        '/menu': '/categories',
        '/categories': '/mobile',
        '/mobile': '/welcome',
      };
      const fallback = fallbackRoutes[location.pathname] || '/welcome';
      navigate(fallback);
    }
  }, [location.pathname, navigate]);

  // Main Category & Subcategory selection handlers
  const openCategory = useCallback((categoryId, subcategoryId = null) => {
    setSelectedMainCategory(categoryId);
    const mainCat = MAIN_CATEGORIES.find(c => c.id === categoryId);
    if (subcategoryId) {
      setSelectedSubcategory(subcategoryId);
    } else if (mainCat && mainCat.subcategories?.length > 0) {
      setSelectedSubcategory(mainCat.subcategories[0].id);
    } else {
      setSelectedSubcategory('coffee_classics');
    }
    navigateTo('/menu');
  }, [navigateTo]);

  const selectMainCategory = useCallback((categoryId) => {
    setSelectedMainCategory(categoryId);
    const mainCat = MAIN_CATEGORIES.find(c => c.id === categoryId);
    if (mainCat && mainCat.subcategories?.length > 0) {
      setSelectedSubcategory(mainCat.subcategories[0].id);
    }
  }, []);

  const selectSubcategory = useCallback((subcategoryId) => {
    setSelectedSubcategory(subcategoryId);
  }, []);

  // Backwards compatibility
  const parentCategory = selectedMainCategory;
  const setParentCategory = setSelectedMainCategory;
  const activeCategory = selectedSubcategory;
  const setActiveCategory = setSelectedSubcategory;

  // Shared Customization State across Voice and Touch
  const [activeCustomization, setActiveCustomization] = useState({
    stepIndex: 0,
    size: 'Regular',
    strength: 'Double Shot',
    milk: 'Regular',
    sugar: 'Regular Sugar',
    quantity: 1,
    unitPrice: 0,
    totalPrice: 0,
    pendingConfirmation: false,
    pourTrigger: 0,
    isVoiceSelection: false,
    voiceTimestamp: null,
  });

  const syncCustomization = useCallback((patch) => {
    setActiveCustomization(prev => {
      const stepChanged = patch.stepIndex !== undefined && patch.stepIndex !== prev.stepIndex;
      const optionChanged = 
        (patch.size && patch.size !== prev.size) ||
        (patch.strength && patch.strength !== prev.strength) ||
        (patch.milk && patch.milk !== prev.milk) ||
        (patch.sugar && patch.sugar !== prev.sugar);
      
      return {
        ...prev,
        ...patch,
        pourTrigger: (stepChanged || optionChanged) ? prev.pourTrigger + 1 : prev.pourTrigger
      };
    });
  }, []);

  const openCustomization = useCallback((product, initialStep = 0) => {
    setSelectedProduct(product);
    setActiveCustomization({
      stepIndex: initialStep,
      size: 'Regular',
      strength: product.mainCategory === 'coffee' ? 'Double Shot' : 'Single Shot',
      milk: 'Regular',
      sugar: 'Regular Sugar',
      quantity: 1,
      unitPrice: product.price,
      totalPrice: product.price,
      pendingConfirmation: false,
      pourTrigger: 1,
      isVoiceSelection: false,
      voiceTimestamp: null,
    });
    navigateTo('/customization');
  }, [navigateTo]);

  // Add customized item to cart
  const addToCart = useCallback((configuredItem) => {
    setCart(prev => {
      const existingIdx = prev.findIndex(item => 
        item.productId === configuredItem.productId &&
        item.size === configuredItem.size &&
        item.temperature === configuredItem.temperature &&
        item.milk === configuredItem.milk &&
        item.sugar === configuredItem.sugar &&
        item.extraShot === configuredItem.extraShot
      );

      if (existingIdx >= 0) {
        const updated = [...prev];
        const currentItem = updated[existingIdx];
        const newQty = currentItem.quantity + configuredItem.quantity;
        updated[existingIdx] = {
          ...currentItem,
          quantity: newQty,
          totalPrice: newQty * currentItem.unitPrice
        };
        return updated;
      }

      return [configuredItem, ...prev];
    });

    showToast(`Added ${configuredItem.quantity}x ${configuredItem.name}`, 'View Tray', () => navigateTo('/cart'));
  }, [navigateTo, showToast]);

  // Quick direct add (for pastries & recommendations)
  const addDirectToCart = useCallback((product) => {
    const defaultItem = {
      cartId: `direct-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      productId: product.id,
      name: product.name,
      image: product.image,
      unitPrice: product.price,
      quantity: 1,
      size: 'Standard',
      temperature: product.defaultTemperature || 'Warm',
      milk: 'None',
      sugar: 'Standard',
      extraShot: false,
      totalPrice: product.price,
      customizationsSummary: [product.notes?.[0] || 'Café Fresh']
    };

    setCart(prev => {
      const matchIdx = prev.findIndex(i => i.productId === product.id && i.size === 'Standard');
      if (matchIdx >= 0) {
        const updated = [...prev];
        updated[matchIdx].quantity += 1;
        updated[matchIdx].totalPrice = updated[matchIdx].quantity * updated[matchIdx].unitPrice;
        return updated;
      }
      return [defaultItem, ...prev];
    });

    showToast(`Added ${product.name} to tray`, 'View Tray', () => navigateTo('/cart'));
  }, [navigateTo, showToast]);

  // Update item quantity in cart
  const updateCartQuantity = useCallback((cartId, delta) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.cartId === cartId) {
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          return {
            ...item,
            quantity: newQty,
            totalPrice: newQty * item.unitPrice
          };
        }
        return item;
      }).filter(Boolean);
    });
  }, []);

  // Remove item from cart
  const removeFromCart = useCallback((cartId) => {
    setCart(prev => prev.filter(item => item.cartId !== cartId));
  }, []);

  // Clear entire cart
  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  // Calculations
  const cartTotals = useMemo(() => {
    const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = cart.reduce((sum, item) => sum + (item.totalPrice || item.unitPrice * item.quantity), 0);
    const taxes = Math.round(subtotal * 0.05);
    const totalPayable = subtotal + taxes;

    return {
      itemCount,
      subtotal,
      taxes,
      totalPayable
    };
  }, [cart]);

  // Wallet Top-up process (simulated)
  const processWalletTopup = useCallback((amount) => {
    const amtNum = Number(amount) || 0;
    if (amtNum <= 0) return;
    setWalletBalance(prev => prev + amtNum);
    setLastTopupAmount(amtNum);
    navigateTo('/wallet-success');
  }, [navigateTo]);

  // Place Order (simulated frontend confirmation)
  const confirmOrder = useCallback((paymentMethod = 'UPI') => {
    const orderNumber = `TWC-${Math.floor(1000 + Math.random() * 9000)}`;
    const newOrder = {
      orderNumber,
      orderType,
      items: [...cart],
      itemCount: cartTotals.itemCount,
      subtotal: cartTotals.subtotal,
      taxes: cartTotals.taxes,
      total: cartTotals.totalPayable,
      paymentMethod,
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      mobileNumber: mobileNumber || 'Walk-in Guest',
      status: 'Preparing'
    };

    setLastOrder(newOrder);
    setCart([]);
    navigateTo('/order-confirmed');
  }, [cart, cartTotals, mobileNumber, navigateTo, orderType]);

  // Start a new order from scratch (clearing all customer context and PII)
  const startNewOrder = useCallback(() => {
    setCart([]);
    setMobileNumber('');
    setSelectedProduct(null);
    setLastOrder(null);
    setLastTopupAmount(null);
    setSelectedMainCategory('coffee');
    setSelectedSubcategory('coffee_classics');
    setOrderType('dine_in');

    try {
      // Purge all customer context from browser sessionStorage
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith('twc_')) {
          sessionStorage.removeItem(key);
        }
      });
    } catch (_) {}

    // Dispatch custom event to notify VoiceBarista and backend lifecycle manager
    window.dispatchEvent(new CustomEvent('twc:session-reset', { detail: { reason: 'start_new_order' } }));

    navigateTo('/welcome', true);
  }, [navigateTo]);

  // Kiosk Inactivity Reset Timer (120s of inactivity returns to /welcome)
  useEffect(() => {
    if (location.pathname === '/welcome' || location.pathname === '/') {
      return;
    }

    let timer = null;

    const resetTimer = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        startNewOrder();
      }, 120000); // 2 minutes
    };

    const events = ['pointerdown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(evt => window.addEventListener(evt, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      if (timer) clearTimeout(timer);
      events.forEach(evt => window.removeEventListener(evt, resetTimer));
    };
  }, [location.pathname, startNewOrder]);

  return (
    <KioskContext.Provider
      value={{
        currentScreen,
        setCurrentScreen,
        navigateTo,
        goBack,
        orderType,
        setOrderType,
        mobileNumber,
        setMobileNumber,
        selectedMainCategory,
        setSelectedMainCategory,
        selectedSubcategory,
        setSelectedSubcategory,
        selectMainCategory,
        selectSubcategory,
        parentCategory,
        setParentCategory,
        activeCategory,
        setActiveCategory,
        openCategory,
        selectedProduct,
        setSelectedProduct,
        openCustomization,
        activeCustomization,
        syncCustomization,
        cart,
        setCart,
        addToCart,
        addDirectToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        cartTotals,
        walletBalance,
        setWalletBalance,
        selectedTopupAmount,
        setSelectedTopupAmount,
        customTopupInput,
        setCustomTopupInput,
        lastTopupAmount,
        processWalletTopup,
        confirmOrder,
        lastOrder,
        startNewOrder,
        toast,
        showToast,
        hideToast
      }}
    >
      {children}
    </KioskContext.Provider>
  );
};

export const useKiosk = () => {
  const context = useContext(KioskContext);
  if (!context) {
    throw new Error('useKiosk must be used within a KioskProvider');
  }
  return context;
};
