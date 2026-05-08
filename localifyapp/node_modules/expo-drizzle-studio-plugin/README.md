# Drizzle Studio for Expo SQLite

Expo dev tools plugin for you to browse your Expo SQLite data with Drizzle Studio 🎉

### Get Started

[Add Expo SQLite to your project](https://docs.expo.dev/versions/latest/sdk/sqlite/)  
  
Install `expo-drizzle-studio-plugin`

```shell
npm i expo-drizzle-studio-plugin
```

Set up Drizzle Studio plugin

```jsx
import { useDrizzleStudio } from "expo-drizzle-studio-plugin";
import * as SQLite from "expo-sqlite";
import { View } from "react-native";

const db = SQLite.openDatabaseSync("db");

export default function App() {
    useDrizzleStudio(db);

    return <View></View>;
}
```

Run an Expo app with Expo SQLite on a physical device, simulator or emulator. Web is not supported.

```shell
npx expo start
```

In the terminal with "start" process, press `shift + m` to present the Dev Tools menu and choose `expo-drizzle-studio-plugin` from the list. Drizzle Studio will open in a new web browser tab.
