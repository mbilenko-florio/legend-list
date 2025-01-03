import { Platform } from "react-native";
import { type StateContext, peek$, set$ } from "./state";

// TODO: this class became too simple, should we totally remove it?
export class ScrollAdjustHandler {
    private appliedAdjust = 0;
    private context: StateContext;
    constructor(private ctx: any) {
        this.context = ctx;
    }

    requestAdjust(adjust: number, onAdjusted: (diff: number) => void) {
        this.appliedAdjust = adjust;
        const doAjdust = () => {
            const oldAdjustTop = peek$<number>(this.context, "scrollAdjust");
            if (oldAdjustTop !== adjust) {
                set$(this.context, "scrollAdjust", adjust);
            }
            onAdjusted(oldAdjustTop-adjust);
        }
        if (Platform.OS === 'ios') {
            // ios needs to scrollAdjust to be set later
            //requestAnimationFrame(doAjdust);
            setTimeout(doAjdust, 5);
        } else {
            doAjdust();
        }
        
    }
    getAppliedAdjust() {
        return this.appliedAdjust;
    }
}
