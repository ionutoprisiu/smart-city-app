import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '@theme';

type Props = {
  count: number;
  onClearAll: () => void;
};

export const CustomPinsBanner: React.FC<Props> = ({ count, onClearAll }) => {
  const theme = useTheme();
  const themedStyles = {
    cardBg: { backgroundColor: theme.colors.errorContainer + '73' },
    title: { color: theme.colors.onSurface, marginLeft: 12, flex: 1 },
    clearPressed: { opacity: 0.7 },
    clearDefault: { opacity: 1 },
    clearText: { color: theme.colors.primary },
  };
  return (
    <View
      style={[
        styles.card,
        themedStyles.cardBg,
      ]}
    >
      <Icon name="push-pin" size={22} color={theme.colors.error} />
      <Text
        style={[
          theme.typography.titleSmall,
          themedStyles.title,
        ]}
      >
        {count} custom pin{count === 1 ? '' : 's'} on map
      </Text>
      <Pressable
        onPress={onClearAll}
        style={({ pressed }) => [
          styles.clearBtn,
          pressed ? themedStyles.clearPressed : themedStyles.clearDefault,
        ]}
      >
        <Text style={[theme.typography.labelLarge, themedStyles.clearText]}>
          Clear all
        </Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 20,
  },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
