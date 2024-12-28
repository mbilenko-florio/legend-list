import { type StateContext, peek$, set$ } from "./state";

// this class handles scroll adjustment for the list
// it makes sure, that it is not adjusting the scroll positionTop and positionBottom at the same time
// TODO: this class parameters are choosed empyrically, it should be tested and adjusted
export class ScrollAdjustHandler {
    private pendingAdjust = 0;
    private appliedAdjust = 0;
    private busy = false;
    private context: StateContext;
    constructor(private ctx: any) {
        this.context = ctx;
    }

    requestAdjust(adjust: number) {
        if (Math.abs(adjust - this.pendingAdjust) < 0.5) {
            return;
        }
        if (this.busy) {
            this.pendingAdjust = adjust;
            return;
        }
        this.busy = true;
        this.pendingAdjust = adjust;
        this.doAdjust(() => {
            this.busy = false;
        });
    }
    doAdjust(callback: () => void) {
        setTimeout(() => {
            const newAdjustTop = this.pendingAdjust;
            const oldAdjutTop = peek$<number>(this.context, "scrollAdjustTop");
            if (oldAdjutTop !== newAdjustTop) {
                set$(this.context, "scrollAdjustTop", newAdjustTop);
                this.appliedAdjust = newAdjustTop;
            }
            setTimeout(() => {
                const oldAdjutBottom = peek$<number>(this.context, "scrollAdjustBottom");
                const newAdjustBottom = -newAdjustTop;
                if (oldAdjutBottom !== newAdjustBottom) {
                    set$(this.context, "scrollAdjustBottom", newAdjustBottom);
                    callback();
                }
            }, 5);
        }, 5);
    }
    getAppliedAdjust() {
        return this.appliedAdjust;
    }
    getPendingAdjust() {
        return this.pendingAdjust;
    }
}

// rapid changes in scrollAdjust can cause result in the invalid scroll position
// this class filters out rapid changes in scrollAdjust
export class ScrollFilter {
    private prevScroll = 0;
    private lastScrollAdjust = 0;
    private jerkTimestamp = -1;


    filter(scroll: number, scrollAdjust: number) {
        const now = performance.now();
        const val = scroll - scrollAdjust;
        const adjustDiff = Math.abs(scrollAdjust - this.lastScrollAdjust);

        if (adjustDiff > 300) {          
            this.jerkTimestamp = now;
            console.log("jerk detected");
        }

        this.lastScrollAdjust = scrollAdjust;
        if (this.jerkTimestamp > 0 && now - this.jerkTimestamp < 300) {
            // if jerk detected, ignore the scroll value for 300ms
            return this.prevScroll;
        }

        this.prevScroll = val;
        this.jerkTimestamp = -1;

        return this.prevScroll;
    }
}
