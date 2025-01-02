import { type StateContext, peek$, set$ } from "./state";

// TODO: this class became too simple, should we totally remove it?
export class ScrollAdjustHandler {
    private appliedAdjust = 0;
    private context: StateContext;
    constructor(private ctx: any) {
        this.context = ctx;
    }

    requestAdjust(adjust: number) {
        const oldAdjutTop = peek$<number>(this.context, "scrollAdjustTop");
        if (oldAdjutTop !== adjust) {
            set$(this.context, "scrollAdjustTop", adjust);
            this.appliedAdjust = adjust;
        }
    }
    getAppliedAdjust() {
        return this.appliedAdjust;
    }
}
