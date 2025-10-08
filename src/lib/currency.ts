/**
 * Utilidades para formateo de moneda argentina
 */

/**
 * Formatea un número como pesos argentinos
 * @param amount - Monto a formatear
 * @returns String formateado como "AR$ 1.234,56"
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

/**
 * Formatea un número sin el símbolo de moneda
 * @param amount - Monto a formatear
 * @returns String formateado como "1.234,56"
 */
export const formatAmount = (amount: number): string => {
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

