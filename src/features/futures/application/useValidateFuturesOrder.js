import { useCallback } from 'react';

/**
 * Returns a lightweight UI validator. tv1 is the source of truth for trading
 * rules, risk and notional checks via /validate-order and order submission.
 *
 * @param {Object|null} tradingRules
 * @returns {{ validate: Function }}
 */
export function useValidateFuturesOrder(tradingRules) {
  const validate = useCallback(
    (order) => {
      const errors = [];

      const { type, quantity, price } = order;
      const { orderTypes } = tradingRules ?? {};

      if (orderTypes && !orderTypes.includes(type)) {
        errors.push(`Order type "${type}" not allowed. Allowed: ${orderTypes.join(', ')}`);
      }

      const qty = parseFloat(quantity);

      if (isNaN(qty) || qty <= 0) {
        errors.push('Quantity must be a positive number');
      }

      if (type === 'LIMIT') {
        const px = parseFloat(price);

        if (isNaN(px) || px <= 0) {
          errors.push('Price must be a positive number for LIMIT orders');
        }
      }

      return { valid: errors.length === 0, errors };
    },
    [tradingRules]
  );

  return { validate };
}
