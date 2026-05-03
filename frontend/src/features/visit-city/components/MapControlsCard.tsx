import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '@theme';

type Props = {
  hasRoute: boolean;
  routeStarted: boolean;
  onRecenter: () => void;
  onModify: () => void;
  onClear: () => void;
};

export const MapControlsCard: React.FC<Props> = ({
  hasRoute,
  routeStarted,
  onRecenter,
  onModify,
  onClear,
}) => {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surfaceContainerHighest + 'EB',
        },
      ]}
    >
      <Pressable onPress={onRecenter} style={styles.button}>
        <Icon name="my-location" size={22} color={theme.colors.onSurface} />
      </Pressable>
      {hasRoute ? (
        <>
          {routeStarted ? (
            <Pressable onPress={onModify} style={styles.button}>
              <Icon name="edit" size={22} color={theme.colors.onSurface} />
            </Pressable>
          ) : null}
          <Pressable onPress={onClear} style={styles.button}>
            <Icon name="close" size={22} color={theme.colors.error} />
          </Pressable>
        </>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    paddingHorizontal: 6,
    paddingVertical: 8,
    alignItems: 'center',
  },
  button: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
