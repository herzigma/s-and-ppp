# S&PPP

This is a modern, responsive web application that visualizes major US market indexes (like the S&P 500, Dow Jones, and NASDAQ) and adjusts their returns for **Purchasing Power Parity (PPP)** across different global currencies. 

While market exchange rates tell you how much a portfolio is worth in a foreign currency, they don't tell the whole story. This tool adjusts those returns for local consumer price inflation, revealing the *real-world buying power* of those investments for investors living outside the US.

## Features

- **Interactive Charting:** Explore index performance over custom timeframes, including specific US Presidential Terms.
- **Currency Conversion:** View returns translated into foreign currencies (e.g., EUR, GBP, CNY) using historical daily market exchange rates.
- **PPP Adjustment:** Toggle Purchasing Power Parity to see how local inflation eats into or boosts real-world returns.
- **Dynamic Insights:** An automated narrative engine that translates the data into plain English, explaining whether an investor would feel wealthier or poorer based on the inflation differentials.
- **Direct Comparisons:** Compare performance across different indexes, currencies, or even prior time periods simultaneously.

## Tech Stack

- **Frontend Framework:** Vanilla JavaScript + HTML/CSS
- **Build Tool:** [Vite](https://vitejs.dev/)
- **Charting:** [Chart.js](https://www.chartjs.org/)
- **Data APIs:**
  - [FRED (Federal Reserve Economic Data) API](https://fred.stlouisfed.org/docs/api/fred/) for market indexes and daily exchange rates.
  - [World Bank API](https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api-documentation) for annual Purchasing Power Parity (PPP) conversion factors.

## Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- A free API key from [FRED](https://fred.stlouisfed.org/docs/api/api_key.html)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/herzigma/s-and-ppp.git
   cd s-and-ppp
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up the proxy server:**
   To avoid CORS issues and properly proxy requests to FRED and the World Bank, this project includes a lightweight Express proxy server.
   
   Create a `.env` file in the `server` directory and add your FRED API key:
   ```bash
   FRED_API_KEY=your_api_key_here
   ```

4. **Run the development environment:**
   We use `concurrently` to run both the Vite frontend and the Node.js proxy server simultaneously.
   ```bash
   npm run dev
   ```

   The app will automatically open in your browser at `http://localhost:5173`. The proxy server runs on port 3001.

## How It Works
- **Market FX:** When converting from USD to another currency, the app uses historical daily spot exchange rates from FRED to calculate the value of the portfolio in the foreign currency.
- **PPP Adjustments:** To find the *real* purchasing power, the app takes the local currency value and divides it by the World Bank's PPP conversion factor for that specific country and year. This adjusts the value based on the relative cost of everyday consumer goods.
- **Data Lag:** Because the World Bank publishes PPP data annually with a lag, recent periods may be extrapolated using the latest available year's data.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
