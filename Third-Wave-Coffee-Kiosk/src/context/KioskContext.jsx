import React, { createContext, useContext, useState, useMemo } from 'react';
import { MAIN_CATEGORIES, PRODUCTS, CUSTOMIZATION_OPTIONS } from '../data/products';

const KioskContext = createContext(null);

export const KioskProvider = ({ children }) => {
  // Navigation State
  const [currentScreen, setCurrentScreen] = useState('welcome');
  const [screenHistory, setScreenHistory] = useState([]);
  
  // Session / Order Mode
  const [orderType, setOrderType] = useState('dine_in'); // 'dine_in' or 'takeaway'
  const [mobileNumber, setMobileNumber] = useState('');

  // 4 Primary Menu Categories: 'coffee' | 'beverages' | 'food' | 'specials'
  const [selectedMainCategory, setSelectedMainCategory] = useState('coffee');
  // Subcategory active in Menu (e.g. 'coffee_classics', 'coffee_twc_specials', etc.)
  const [selectedSubcategory, setSelectedSubcategory] = useState('coffee_classics');
  
  // Customization selection
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Cart: initial sample items for kiosk ready experience
  const [cart, setCart] = useState([
    {
      cartId: 'item-demo-1',
      productId: 'cappuccino',
      name: 'Cappuccino',
      image: 'https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=800&q=80',
      unitPrice: 260,
      quantity: 1,
      size: 'Regular',
      temperature: 'Hot',
      milk: 'Standard Dairy',
      sugar: 'Regular Sugar',
      extraShot: false,
      totalPrice: 260,
      customizationsSummary: ['Regular (240ml)', 'Hot', 'Standard Milk', 'Regular Sugar']
    },
    {
      cartId: 'item-demo-2',
      productId: 'vietnamese_shakerato',
      name: 'Vietnamese Shakerato',
      image: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=800&q=80',
      unitPrice: 310,
      quantity: 1,
      size: 'Regular',
      temperature: 'Iced',
      milk: 'Standard Dairy',
      sugar: 'Condensed Milk Blend',
      extraShot: false,
      totalPrice: 310,
      customizationsSummary: ['Regular (240ml)', 'Iced', 'Condensed Milk Recipe']
    }
  ]);

  // Wallet
  const [walletBalance, setWalletBalance] = useState(450);
  const [selectedTopupAmount, setSelectedTopupAmount] = useState(600);
  const [customTopupInput, setCustomTopupInput] = useState('');
  const [lastTopupAmount, setLastTopupAmount] = useState(600);

  // Order Details
  const [lastOrder, setLastOrder] = useState(null);

  // Toast Notification
  const [toast, setToast] = useState({ show: false, message: '', actionText: '', onAction: null });

  const showToast = (message, actionText = '', onAction = null) => {
    setToast({ show: true, message, actionText, onAction });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 3800);
  };

  const hideToast = () => {
    setToast(prev => ({ ...prev, show: false }));
  };

  // Navigation handlers
  const navigateTo = (screen, replace = false) => {
    if (!replace && screen !== currentScreen) {
      setScreenHistory(prev => [...prev, currentScreen]);
    }
    setCurrentScreen(screen);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goBack = () => {
    if (screenHistory.length > 0) {
      const prev = screenHistory[screenHistory.length - 1];
      setScreenHistory(screenHistory.slice(0, -1));
      setCurrentScreen(prev);
    } else {
      // Sensible defaults
      if (currentScreen === 'cart') setCurrentScreen('menu');
      else if (currentScreen === 'customization') setCurrentScreen('menu');
      else if (currentScreen === 'menu') setCurrentScreen('categories');
      else if (currentScreen === 'categories') setCurrentScreen('mobile');
      else if (currentScreen === 'mobile') setCurrentScreen('welcome');
      else if (currentScreen === 'wallet_topup') setCurrentScreen('cart');
      else if (currentScreen === 'wallet_success') setCurrentScreen('cart');
      else setCurrentScreen('welcome');
    }
  };

  // Main Category & Subcategory selection handlers
  const openCategory = (categoryId, subcategoryId = null) => {
    setSelectedMainCategory(categoryId);
    const mainCat = MAIN_CATEGORIES.find(c => c.id === categoryId);
    if (subcategoryId) {
      setSelectedSubcategory(subcategoryId);
    } else if (mainCat && mainCat.subcategories?.length > 0) {
      setSelectedSubcategory(mainCat.subcategories[0].id);
    } else {
      setSelectedSubcategory('coffee_classics');
    }
    navigateTo('menu');
  };

  const selectMainCategory = (categoryId) => {
    setSelectedMainCategory(categoryId);
    const mainCat = MAIN_CATEGORIES.find(c => c.id === categoryId);
    if (mainCat && mainCat.subcategories?.length > 0) {
      setSelectedSubcategory(mainCat.subcategories[0].id);
    }
  };

  const selectSubcategory = (subcategoryId) => {
    setSelectedSubcategory(subcategoryId);
  };

  // Backwards compatibility
  const parentCategory = selectedMainCategory;
  const setParentCategory = setSelectedMainCategory;
  const activeCategory = selectedSubcategory;
  const setActiveCategory = setSelectedSubcategory;

  const openCustomization = (product) => {
    setSelectedProduct(product);
    navigateTo('customization');
  };

  // Add customized item to cart
  const addToCart = (configuredItem) => {
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

    showToast(`Added ${configuredItem.quantity}x ${configuredItem.name}`, 'View Tray', () => navigateTo('cart'));
  };

  // Quick direct add (for pastries & recommendations)
  const addDirectToCart = (product) => {
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

    showToast(`Added ${product.name} to tray`, 'View Tray', () => navigateTo('cart'));
  };

  // Update item quantity in cart
  const updateCartQuantity = (cartId, delta) => {
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
  };

  // Remove item from cart
  const removeFromCart = (cartId) => {
    setCart(prev => prev.filter(item => item.cartId !== cartId));
  };

  // Clear entire cart
  const clearCart = () => {
    setCart([]);
  };

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
  const processWalletTopup = (amount) => {
    const amtNum = Number(amount) || 0;
    if (amtNum <= 0) return;
    setWalletBalance(prev => prev + amtNum);
    setLastTopupAmount(amtNum);
    navigateTo('wallet_success');
  };

  // Place Order (simulated frontend confirmation)
  const confirmOrder = (paymentMethod = 'UPI') => {
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
    navigateTo('order_confirmed');
  };

  // Start a new order from scratch
  const startNewOrder = () => {
    setCart([]);
    setMobileNumber('');
    setSelectedProduct(null);
    setLastOrder(null);
    setScreenHistory([]);
    setCurrentScreen('welcome');
  };

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
        cart,
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
