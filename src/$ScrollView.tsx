import * as React from "react";
import { ScrollView, type ScrollViewProps, StyleSheet } from "react-native";
import { USE_CONTENT_INSET } from "./constants";
import { use$ } from "./state";

const OFFSET_TEST = 0;

// A component that listens to a signal and updates its style based on the signal.
// This is a performance optimization to avoid unnecessary renders because it doesn't need to re-render the entire component.
export const $ScrollView = React.forwardRef(function $ScrollView(props: ScrollViewProps, ref: React.Ref<ScrollView>) {
    const { style, horizontal, ...rest } = props;
    // Re-render whenever scrollAdjust changes
    const scrollAdjust = use$<number>("scrollAdjust");
    const adjustProps: ScrollViewProps = {};

    if (scrollAdjust !== 0) {
        if (USE_CONTENT_INSET) {
            adjustProps.contentInset = horizontal ? { left: -scrollAdjust } : { top: -scrollAdjust + OFFSET_TEST };
            if (OFFSET_TEST) {
                adjustProps.contentContainerStyle = { marginTop: OFFSET_TEST };
            }
        } else {
            adjustProps.style = horizontal ? { marginLeft: -scrollAdjust } : { marginTop: -scrollAdjust };
            if (style) {
                adjustProps.style = StyleSheet.compose(style, adjustProps.style);
            }
        }
        console.log("scrollAdjust", scrollAdjust);
    }

    return <ScrollView {...rest} style={style} horizontal={horizontal} {...adjustProps} ref={ref} />;
});
