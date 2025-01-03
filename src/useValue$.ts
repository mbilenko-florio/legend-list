import { } from "react";
import { } from "react-native";
import { getAnimatedValue, peek$, useStateContext } from "./state";
import type { ListenerType } from "./state";



export function useValue$(key: ListenerType, getValue?: (value: number) => number, key2?: ListenerType) {
    const ctx = useStateContext();
    const v = peek$(ctx, key) ?? 0;
    return getAnimatedValue(ctx, key, (getValue ? getValue(v) : v) ?? 0)[0];

}
