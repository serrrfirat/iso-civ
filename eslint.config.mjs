import nextConfig from "eslint-config-next";

const config = [
  ...nextConfig,
  {
    rules: {
      // Disable immutability check for refs - mutating refs is valid
      "react-hooks/immutability": "off",
    },
  },
];

export default config;
