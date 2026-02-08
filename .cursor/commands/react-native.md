# React Native Architecture

Build production React Native apps with Expo, navigation, native modules, offline sync, and cross-platform patterns. Use when developing mobile apps, implementing native integrations, or architecting React Native projects.

## When to Use

- Starting a new React Native or Expo project
- Implementing complex navigation patterns
- Integrating native modules and platform APIs
- Building offline-first mobile applications
- Optimizing React Native performance
- Setting up CI/CD for mobile releases

## Core Concepts

### Project Structure

```
src/
├── app/                    # Expo Router screens
│   ├── (auth)/            # Auth group
│   ├── (tabs)/            # Tab navigation
│   └── _layout.tsx        # Root layout
├── components/
│   ├── ui/                # Reusable UI components
│   └── features/          # Feature-specific components
├── hooks/                 # Custom hooks
├── services/              # API and native services
├── stores/                # State management
├── utils/                 # Utilities
└── types/                 # TypeScript types
```

### Expo vs Bare React Native

| Feature | Expo | Bare RN |
|---------|------|---------|
| Setup complexity | Low | High |
| Native modules | EAS Build | Manual linking |
| OTA updates | Built-in | Manual setup |
| Build service | EAS | Custom CI |
| Custom native code | Config plugins | Direct access |

## Quick Start

```bash
# Create new Expo project
npx create-expo-app@latest my-app -t expo-template-blank-typescript

# Install essential dependencies
npx expo install expo-router expo-status-bar react-native-safe-area-context
npx expo install @react-native-async-storage/async-storage
npx expo install expo-secure-store expo-haptics
```

```typescript
// app/_layout.tsx
import { Stack } from 'expo-router'
import { ThemeProvider } from '@/providers/ThemeProvider'
import { QueryProvider } from '@/providers/QueryProvider'

export default function RootLayout() {
  return (
    <QueryProvider>
      <ThemeProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        </Stack>
      </ThemeProvider>
    </QueryProvider>
  )
}
```

## Key Patterns

### 1. Expo Router Navigation

```typescript
// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router'
import { Home, Search, User, Settings } from 'lucide-react-native'

export default function TabLayout() {
  const { colors } = useTheme()

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
    </Tabs>
  )
}

// Navigation
import { router } from 'expo-router'
router.push('/profile/123')
router.replace('/login')
router.back()
```

### 2. Authentication Flow

```typescript
// providers/AuthProvider.tsx
import * as SecureStore from 'expo-secure-store'
import { useRouter, useSegments } from 'expo-router'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    const inAuthGroup = segments[0] === '(auth)'

    if (!user && !inAuthGroup) {
      router.replace('/login')
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)')
    }
  }, [user, segments, isLoading])

  // ...
}
```

### 3. Offline-First with React Query

```typescript
import { QueryClient } from '@tanstack/react-query'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import AsyncStorage from '@react-native-async-storage/async-storage'
import NetInfo from '@react-native-community/netinfo'

// Sync online status
onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    setOnline(!!state.isConnected)
  })
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      staleTime: 1000 * 60 * 5,    // 5 minutes
      networkMode: 'offlineFirst',
    },
  },
})
```

### 4. Native Module Integration

```typescript
// Haptics
import * as Haptics from 'expo-haptics'
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

// Biometrics
import * as LocalAuthentication from 'expo-local-authentication'
const result = await LocalAuthentication.authenticateAsync({
  promptMessage: 'Authenticate to continue',
})

// Push Notifications
import * as Notifications from 'expo-notifications'
const token = (await Notifications.getExpoPushTokenAsync()).data
```

### 5. Performance Optimization

```typescript
// Use FlashList over FlatList
import { FlashList } from '@shopify/flash-list'

<FlashList
  data={products}
  renderItem={renderItem}
  estimatedItemSize={100}
  removeClippedSubviews={true}
/>

// Memoize components
const ProductItem = memo(function ProductItem({ item, onPress }) {
  // ...
})

// Use Reanimated for 60fps animations
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated'
```

## EAS Build & Submit

```json
// eas.json
{
  "build": {
    "development": { "developmentClient": true, "distribution": "internal" },
    "preview": { "distribution": "internal" },
    "production": { "autoIncrement": true }
  }
}
```

```bash
eas build --platform all --profile production
eas submit --platform ios
eas update --branch production --message "Bug fixes"
```

## Best Practices

### Do's
- **Use Expo** - Faster development, OTA updates
- **FlashList over FlatList** - Better performance
- **Memoize components** - Prevent re-renders
- **Use Reanimated** - 60fps native animations
- **Test on real devices** - Simulators miss issues

### Don'ts
- **Don't inline styles** - Use StyleSheet.create
- **Don't fetch in render** - Use useEffect/React Query
- **Don't ignore platforms** - Test iOS and Android
- **Don't store secrets in code** - Use env variables
- **Don't skip error boundaries** - Mobile crashes hard

## Resources

- [Expo Documentation](https://docs.expo.dev/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [React Native Performance](https://reactnative.dev/docs/performance)
- [FlashList](https://shopify.github.io/flash-list/)
