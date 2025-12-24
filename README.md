# IsoCity

IsoCity is a open-source isometric city-building simulation game built with **Next.js**, **TypeScript**, and **Tailwind CSS**. It leverages the HTML5 Canvas API for high-performance rendering of isometric graphics, featuring complex systems for economic simulation, trains, planes, seaplanes, helicopters, cars, pedestrians, and more.

![IsoCity Banner](public/readme-image.png)

## Features

-   **Isometric Rendering Engine**: Custom-built rendering system using HTML5 Canvas (`CanvasIsometricGrid`) capable of handling complex depth sorting and layer management.
-   **Dynamic Simulation**:
    -   **Traffic System**: Autonomous vehicles including cars, trains, and aircraft (planes/seaplanes).
    -   **Pedestrian System**: Pathfinding and crowd simulation for city inhabitants.
    -   **Economy & Resources**: Resource management, zoning (Residential, Commercial, Industrial), and city growth logic.
-   **Interactive Grid**: Tile-based placement system for buildings, roads, parks, and utilities.
-   **State Management**: Save/Load functionality for multiple cities.
-   **Responsive Design**: Mobile-friendly interface with specialized touch controls and toolbars.

## Tech Stack

-   **Framework**: [Next.js 14+](https://nextjs.org/) (App Router)
-   **Language**: [TypeScript](https://www.typescriptlang.org/)
-   **Styling**: [Tailwind CSS](https://tailwindcss.com/) & [shadcn/ui](https://ui.shadcn.com/) components.
-   **Graphics**: HTML5 Canvas API (No external game engine libraries; pure native implementation).
-   **Icons**: Lucide React.

## 📂 Project Structure

The project follows a modular architecture separating the rendering engine, simulation logic, and UI components.

```
isocity/
├── public/                 # Static assets (sprites, textures, icons)
│   └── assets/             # Game assets (buildings, vehicles, terrain)
├── src/
│   ├── app/                # Next.js App Router pages and layouts
│   ├── components/
│   │   ├── game/           # CORE GAME ENGINE
│   │   │   ├── systems/    # (Conceptually grouped logic files)
│   │   │   │   ├── trafficSystem.ts    # Car movement logic
│   │   │   │   ├── pedestrianSystem.ts # Crowd logic
│   │   │   │   ├── railSystem.ts       # Trains and trams
│   │   │   │   └── aircraftSystems.ts  # Planes and airport logic
│   │   │   ├── CanvasIsometricGrid.tsx # Main rendering component
│   │   │   ├── drawing.ts              # Canvas drawing helpers
│   │   │   └── gridFinders.ts          # Pathfinding and grid utilities
│   │   ├── ui/             # Reusable UI components (Buttons, Dialogs, etc.)
│   │   └── buildings/      # Building-specific React components
│   ├── context/            # Global state (GameContext)
│   ├── lib/
│   │   ├── simulation.ts   # Core simulation loop and state updates
│   │   └── utils.ts        # Helper functions
│   ├── hooks/              # Custom React hooks (useCheatCodes, useMobile)
│   └── types/              # TypeScript definitions
└── ...
```

### Key Directories Explained

-   **`src/components/game/`**: This is where the magic happens. It contains the logic for drawing the isometric grid, handling user input on the canvas, and the various sub-systems that control the city's life (traffic, weather, overlays).
-   **`src/lib/simulation.ts`**: Handles the underlying mathematical model of the city—calculating population growth, tax income, and resource consumption independent of the visual layer.
-   **`src/resources/`**: Contains example save states (`example_state.json`) useful for testing or initializing the game with a pre-built city.

## Getting Started

### Prerequisites

-   Node.js (v18 or higher)
-   npm or yarn

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/truncgil/isometric-city.git
    cd isometric-city
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Run the development server:**
    ```bash
    npm run dev
    ```

4.  **Open the game:**
    Visit [http://localhost:3000](http://localhost:3000) in your browser.

## Contributing

Contributions are welcome! Whether it's reporting a bug, proposing a new feature, or submitting a pull request, your input is valued.

Please ensure your code follows the existing style and conventions.

## License

Distributed under the MIT License. See `LICENSE` for more information.
