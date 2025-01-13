import { getAnimatedValue, peek$, useStateContext } from "./state";
import type { ListenerType } from "./state";


export function useValue$(key: ListenerType) {
    const ctx = useStateContext();
    return getAnimatedValue(ctx, key);
}
