import { useCallback } from 'react';

/**
 * Returns a `validate` function that checks a futures order against
 * the symbol's trading rules and returns { valid, errors }.
 *
 * @param {Object|null} tradingRules
 * @returns {{ validate: Function }}
 */
export function useValidateFuturesOrder(tradingRules) {
  const validate = useCallback(
    (order) => {
      const errors = [];

      if (!tradingRules) {
        errors.push('Trading rules not loaded');
        return { valid: false, errors };
      }

      const { type, quantity, price } = order;
      const { tickSize, stepSize, minQty, maxQty, minNotional, orderTypes, status } = tradingRules;

      // Symbol must be in TRADING status
      if (status && status !== 'TRADING') {
        errors.push(`Symbol is not in TRADING status (current: ${status})`);
      }

      // Order type must be allowed
      if (orderTypes && !orderTypes.includes(type)) {
        errors.push(`Order type "${type}" not allowed. Allowed: ${orderTypes.join(', ')}`);
      }

      const qty = parseFloat(quantity);

      if (isNaN(qty) || qty <= 0) {
        errors.push('Quantity must be a positive number');
      } else {
        // stepSize compliance
        if (stepSize > 0) {
          const rem = Math.abs((qty / stepSize) - Math.round(qty / stepSize));
          if (rem > 1e-9) {
            errors.push(`Quantity must be a multiple of stepSize (${stepSize})`);
          }
        }
        if (qty < minQty) errors.push(`Quantity ${qty} is below minimum (${minQty})`);
        if (maxQty && qty > maxQty) errors.push(`Quantity ${qty} exceeds maximum (${maxQty})`);
      }

      // Price validations only for LIMIT orders
      if (type === 'LIMIT') {
        const px = parseFloat(price);

        if (isNaN(px) || px <= 0) {
          errors.push('Price must be a positive number for LIMIT orders');
        } else {
          // tickSize compliance
          if (tickSize > 0) {
            const rem = Math.abs((px / tickSize) - Math.round(px / tickSize));
            if (rem > 1e-9) {
              errors.push(`Price must be a multiple of tickSize (${tickSize})`);
            }
          }

          // Notional check
          if (!isNaN(qty) && qty > 0) {
            const notional = qty * px;
            if (notional < (minNotional || 0)) {
              errors.push(`Notional (${notional.toFixed(2)}) is below minimum (${minNotional})`);
            }
          }
        }
      }

      return { valid: errors.length === 0, errors };
    },
    [tradingRules]
  );

  return { validate };
}
