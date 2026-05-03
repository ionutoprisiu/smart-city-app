import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@theme';

export const SplashScreen: React.FC = () => {
  const theme = useTheme();
  const themedStyles = {
    containerBg: { backgroundColor: theme.colors.surface },
    logoBg: { backgroundColor: theme.colors.primaryContainer },
    logoText: { color: theme.colors.onPrimaryContainer },
    titleText: { color: theme.colors.onSurface, marginTop: 24 },
    loaderSpace: { marginTop: 24 },
  };
  return (
    <SafeAreaView style={[styles.container, themedStyles.containerBg]} edges={['top', 'bottom', 'left', 'right']}>
      <View style={[styles.logo, themedStyles.logoBg]}>
        <Text style={[theme.typography.headlineSmall, themedStyles.logoText]}>
          SC
        </Text>
      </View>
      <Text style={[theme.typography.titleLarge, themedStyles.titleText]}>
        Smart City
      </Text>
      <ActivityIndicator
        size="small"
        color={theme.colors.primary}
        style={themedStyles.loaderSpace}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
