import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { AppButton } from '../../../shared/components/AppButton';
import { useTheme } from '../../../theme';

type Props = {
  onStart: () => void;
  onModify: () => void;
};

export const RouteStartBar: React.FC<Props> = ({ onStart, onModify }) => {
  const theme = useTheme();
  const themedStyles = {
    cardBg: { backgroundColor: theme.colors.surfaceContainerHighest + 'F2' },
    title: { color: theme.colors.onSurface, marginLeft: 12, flex: 1 },
  };
  return (
    <View
      style={[
        styles.card,
        themedStyles.cardBg,
      ]}
    >
      <Icon name="route" size={22} color={theme.colors.primary} />
      <Text
        style={[
          theme.typography.titleSmall,
          themedStyles.title,
        ]}
      >
        Route ready
      </Text>
      <AppButton label="Modify" variant="text" onPress={onModify} />
      <View style={styles.spacer} />
      <AppButton label="Start" variant="filled" iconName="play-arrow" onPress={onStart} />
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
  spacer: {
    width: 4,
  },
});
