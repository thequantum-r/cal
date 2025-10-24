import { useEffect } from 'react'

/**
 * ⚡ useTradingViewChart Hook - Lazy loads TradingView widget script
 * Only loads on client side, only when needed, with proper cleanup
 */
export function useTradingViewChart(ticker, exchange) {
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return

    if (!ticker || !exchange) return

    // Small delay to ensure DOM is ready
    const timeout = setTimeout(() => {
      try {
        // Remove existing script to prevent duplicates
        const existingScript = document.getElementById('tradingview-script')
        if (existingScript) {
          existingScript.remove()
        }

        // Remove existing widget
        const widgetContainer = document.getElementById('tradingview-widget')
        if (widgetContainer) {
          widgetContainer.innerHTML = ''
        }

        // Create and configure script
        const script = document.createElement('script')
        script.id = 'tradingview-script'
        script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js'
        script.async = true

        // Set the widget configuration
        script.innerHTML = JSON.stringify({
          symbols: [[`${exchange}:${ticker}`]],
          width: '100%',
          height: 400,
          locale: 'en',
          colorTheme: 'light',
          dateRange: '1M',
          interval: '1W',
          trendLineColor: '#ec741eff',
          underLineColor: 'rgba(0, 0, 0, 0)',
          isTransparent: false,
          autosize: true,
          showFloatingTooltip: true,
          showSymbolLogo: true,
          showChartTitle: true,
          scalePosition: 'left',
          hideDateRanges: false,
          priceFormat: {
            type: 'price',
            precision: 2,
            minMove: 0.01,
          },
          numberFormat: {
            decimalSign: '.',
            thousandsSeparator: ',',
            currencyFormat: {
              symbol: '$',
              position: 'before'
            }
          }
        })

        // Append script to trigger widget rendering
        const container = document.getElementById('tradingview-widget')
        if (container) {
          container.appendChild(script)
        }
      } catch (err) {
        console.error('Error initializing TradingView chart:', err)
      }
    }, 100)

    return () => {
      clearTimeout(timeout)
    }
  }, [ticker, exchange])
}
