import React from 'react';
import { Navigate } from 'react-router-dom';
import { useKiosk } from '../context/KioskContext';
import { OrderConfirmationScreen } from '../screens/OrderConfirmationScreen';
import { WalletSuccessScreen } from '../screens/WalletSuccessScreen';

/**
 * Route Guard for Order Confirmation
 * Ensures users cannot access /order-confirmed directly without an active, confirmed order.
 */
export const OrderConfirmedGuard = () => {
  const { lastOrder } = useKiosk();

  if (!lastOrder) {
    return <Navigate to="/welcome" replace />;
  }

  return <OrderConfirmationScreen />;
};

/**
 * Route Guard for Wallet Success
 * Ensures users cannot access /wallet-success directly without an active top-up amount.
 */
export const WalletSuccessGuard = () => {
  const { lastTopupAmount } = useKiosk();

  if (!lastTopupAmount) {
    return <Navigate to="/cart" replace />;
  }

  return <WalletSuccessScreen />;
};

