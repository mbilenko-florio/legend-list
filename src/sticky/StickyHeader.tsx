import { useMemo } from "react";
import { View } from "react-native";
import { use$ } from "../state";

type Props = {
    getRenderedItem: (key: string, containerId: number) => React.ReactNode;
};

export const StickyHeader = ({ getRenderedItem }: Props) => {
    const sticky = use$<string | undefined>("stickyHeaderIndex");
    // const stickyPosition = useValue$("stickyHeaderPosition");
    const renderedItem = useMemo(() => sticky !== undefined && getRenderedItem(sticky, 0), [sticky]);
    if (sticky === undefined) {
        return null;
    }
    return (
        <View
            style={
                {
                    // position: "absolute",
                    // top: stickyPosition,
                    // left: 0,
                    // right: 0,
                    // zIndex: 100,
                    // backgroundColor: "blue",
                }
            }
        >
            {renderedItem}
        </View>
    );
};
