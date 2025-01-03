import * as React from "react";
import { useSyncExternalStore } from "react";
import { Animated } from "react-native";
import type { ViewAmountToken, ViewToken, ViewabilityAmountCallback, ViewabilityCallback } from "./types";

// This is an implementation of a simple state management system, inspired by Legend State.
// It stores values and listeners in Maps, with peek$ and set$ functions to get and set values.
// The set$ function also triggers the listeners.
//
// This is definitely not general purpose and has one big optimization/caveat: use$ is only ever called
// once for each unique name. So we don't need to manage a Set of listeners or dispose them,
// which saves needing useEffect hooks or managing listeners in a Set.

export type ListenerType =
    | "numContainers"
    | "numContainersPooled"
    | `containerItemKey${number}`
    | `containerPosition${number}`
    | `containerColumn${number}`
    | `containerDidLayout${number}`
    | "numColumns"
    | `lastItemKey`
    | "totalSize"
    | "paddingTop"
    | "stylePaddingTop"
    | "scrollAdjust"
    | "headerSize"
    | "footerSize"
    | "otherAxisSize";

export interface StateContext {
    listeners: Map<ListenerType, Set<(value: any) => void>>;
    values: Map<ListenerType, any>;
    animatedValues: Map<ListenerType, Animated.Value>;
    mapViewabilityCallbacks: Map<string, ViewabilityCallback>;
    mapViewabilityValues: Map<string, ViewToken>;
    mapViewabilityAmountCallbacks: Map<number, ViewabilityAmountCallback>;
    mapViewabilityAmountValues: Map<number, ViewAmountToken>;
}

const ContextState = React.createContext<StateContext | null>(null);

export function StateProvider({ children }: { children: React.ReactNode }) {
    const [value] = React.useState(() => ({
        listeners: new Map(),
        values: new Map(),
        animatedValues: new Map(),
        mapViewabilityCallbacks: new Map<string, ViewabilityCallback>(),
        mapViewabilityValues: new Map<string, ViewToken>(),
        mapViewabilityAmountCallbacks: new Map<number, ViewabilityAmountCallback>(),
        mapViewabilityAmountValues: new Map<number, ViewAmountToken>(),
    }));
    return <ContextState.Provider value={value}>{children}</ContextState.Provider>;
}

export function useStateContext() {
    return React.useContext(ContextState)!;
}

export function use$<T>(signalName: ListenerType): T {
    const ctx = React.useContext(ContextState)!;
    const value = useSyncExternalStore(
        (onStoreChange) => listen$(ctx, signalName, onStoreChange),
        () => ctx.values.get(signalName),
    );

    return value;
}

export function listen$<T>(ctx: StateContext, signalName: ListenerType, cb: (value: T) => void): () => void {
    const { listeners } = ctx;
    let setListeners = listeners.get(signalName);
    if (!setListeners) {
        setListeners = new Set();
        listeners.set(signalName, setListeners);
    }
    setListeners!.add(cb);

    return () => setListeners!.delete(cb);
}

export function peek$<T>(ctx: StateContext, signalName: ListenerType): T {
    const { values } = ctx;
    return values.get(signalName);
}

export const getAnimatedValue = (ctx: StateContext, signalName: ListenerType, initialValue?: any) => {
    const { animatedValues } = ctx;
    let value = animatedValues.get(signalName);
    let isNew = false;
    if (!value) {
        isNew = true;
        console.log("Creating new animated value", signalName, initialValue);
        value = new Animated.Value(initialValue);
        animatedValues.set(signalName, value);
    }
    return [value, isNew] as const;
}

export function set$(ctx: StateContext, signalName: ListenerType, value: any, animated?: boolean) {
    const { listeners, values } = ctx;
    if (values.get(signalName) !== value) {
        values.set(signalName, value);
        if (animated) {
            const [animValue, isNew] = getAnimatedValue(ctx, signalName, value);
            console.log("Setting animated value", signalName, value);
            if (!isNew) {
                animValue.setValue(value);
            }
        }
        const setListeners = listeners.get(signalName);
        if (setListeners) {
            for (const listener of setListeners) {
                listener(value);
            }
        }
    }
}
