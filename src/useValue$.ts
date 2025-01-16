import { useMemo, useRef } from 'react';
import { Animated, useAnimatedValue as _useAnimatedValue } from 'react-native';
import { listen$, peek$, useStateContext } from './state';
import type { ListenerType } from './state';

const useAnimatedValue =
    _useAnimatedValue ||
    ((initialValue: number): Animated.Value => {
        return useRef(new Animated.Value(initialValue)).current;
    });

export function useValue$(key: ListenerType, getValue?: (value: number) => number, key2?: ListenerType) {
    const ctx = useStateContext();
    const animValue = useAnimatedValue((getValue ? getValue(peek$(ctx, key)) : peek$(ctx, key)) ?? 0);
    useMemo(() => {
        listen$<number>(ctx, key, (v) => animValue.setValue(getValue ? getValue(v) : v));
    }, []);

    return animValue;
}
