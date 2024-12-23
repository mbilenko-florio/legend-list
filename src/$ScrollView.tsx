import * as React from "react";
import { ScrollView, type ScrollViewProps, } from "react-native";



// A component that listens to a signal and updates its style based on the signal.
// This is a performance optimization to avoid unnecessary renders because it doesn't need to re-render the entire component.
export const $ScrollView = React.forwardRef(function $ScrollView(props: ScrollViewProps, ref: React.Ref<ScrollView>) {
    const { style, horizontal, ...rest } = props;
  

    return <ScrollView {...rest} style={style} horizontal={horizontal} ref={ref} />;
});

