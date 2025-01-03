import React, { useMemo } from "react";
import { Animated, type DimensionValue, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import { peek$, set$, use$, useStateContext } from "./state";
import { useValue$ } from "./useValue$";

type MeasureMethod = "offscreen" | "invisible";
const MEASURE_METHOD = "invisible" as MeasureMethod;

export const Container = ({
    id,
    recycleItems,
    horizontal,
    getRenderedItem,
    updateItemSize,
    ItemSeparatorComponent,
}: {
    id: number;
    recycleItems?: boolean;
    horizontal: boolean;
    getRenderedItem: (key: string, containerId: number) => React.ReactNode;
    updateItemSize: (containerId: number, itemKey: string, size: number) => void;
    ItemSeparatorComponent?: React.ReactNode;
}) => {
    const ctx = useStateContext();
    const position = useValue$(`containerPosition${id}`);
    const column = use$<number>(`containerColumn${id}`) || 0;
    const animVisible = useValue$(`containerDidLayout${id}`);
    const numColumns = use$<number>("numColumns");
    
  

    const otherAxisPos: DimensionValue | undefined = numColumns > 1 ? `${((column - 1) / numColumns) * 100}%` : 0;
    const otherAxisSize: DimensionValue | undefined = numColumns > 1 ? `${(1 / numColumns) * 100}%` : undefined;
    const style: StyleProp<ViewStyle> = horizontal
        ? {
              flexDirection: "row",
              position: "absolute",
              top: otherAxisPos,
              bottom: numColumns > 1 ? null : 0,
              height: otherAxisSize,
              left: position,
              //opacity: animVisible
          }
        : {
              position: "absolute",
              left: otherAxisPos,
              right: numColumns > 1 ? null : 0,
              width: otherAxisSize,
              top: position,
              //opacity: animVisible
          };

    const lastItemKey = use$<string>("lastItemKey");
    const itemKey = use$<string>(`containerItemKey${id}`);

    const renderedItem = useMemo(() => itemKey !== undefined && getRenderedItem(itemKey, id), [itemKey]);

    // Use a reactive View to ensure the container element itself
    // is not rendered when style changes, only the style prop.
    // This is a big perf boost to do less work rendering.
    return (
        <Animated.View
            style={style}
            onLayout={(event: LayoutChangeEvent) => {
                const key = peek$<string>(ctx, `containerItemKey${id}`);
                if (key !== undefined) {
                    // Round to nearest quater pixel to avoid accumulating rounding errors
                    const size = Math.floor(event.nativeEvent.layout[horizontal ? "width" : "height"] * 8) / 8;

                    updateItemSize(id, key, size);

                    // const otherAxisSize = horizontal ? event.nativeEvent.layout.width : event.nativeEvent.layout.height;
                    // set$(ctx, "otherAxisSize", Math.max(otherAxisSize, peek$(ctx, "otherAxisSize") || 0));

                    // const measured = peek$(ctx, `containerDidLayout${id}`);
                    // if (!measured) {
                    //     requestAnimationFrame(() => {
                            set$(ctx, `containerDidLayout${id}`, true);
                    //    });
                   // }
                }
            }}
        >
            <React.Fragment key={recycleItems ? undefined : itemKey}>
                {renderedItem}
                {renderedItem && ItemSeparatorComponent && itemKey !== lastItemKey && ItemSeparatorComponent}
            </React.Fragment>
        </Animated.View>
    );
};
