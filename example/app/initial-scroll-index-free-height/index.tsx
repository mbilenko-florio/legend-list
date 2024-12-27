import { type Item, renderItem } from "@/app/cards-renderItem";
import { DRAW_DISTANCE, ESTIMATED_ITEM_LENGTH } from "@/constants/constants";
import { LegendList, type LegendListRef } from "@legendapp/list";
import { useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";

//** Purpose of this component is to show that LegendList with initialScrollIndex can correctly scroll to the begginning
// and the end of the list even if element height is unknown and calculated dynamically */
export default function IntialScrollIndexFreeHeight() {
    const listRef = useRef<LegendListRef>(null);

    const [data, setData] = useState<Item[]>(
        () =>
            Array.from({ length: 30 }, (_, i) => ({
                id: i.toString(),
            })) as any[],
    );

    return (
        <View style={[StyleSheet.absoluteFill, styles.outerContainer]} key="legendlist">
            <LegendList
                ref={listRef}
                initialScrollIndex={10}
                style={[StyleSheet.absoluteFill, styles.scrollContainer]}
                contentContainerStyle={styles.listContainer}
                data={data}
                renderItem={renderItem}
                keyExtractor={(item) => `id${item.id}`}
                estimatedItemSize={ESTIMATED_ITEM_LENGTH*2}
                drawDistance={DRAW_DISTANCE}
                maintainVisibleContentPosition
                recycleItems={true}
                //numColumns={2}
                onStartReached={(props) => {
                    console.log("onStartReached", props);
                }}
                onEndReached={({ distanceFromEnd }) => {
                    console.log("onEndReached", distanceFromEnd);
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    listHeader: {
        alignSelf: "center",
        height: 100,
        width: 100,
        backgroundColor: "#456AAA",
        borderRadius: 12,
        marginHorizontal: 8,
        marginVertical: 8,
    },
    listEmpty: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#6789AB",
        paddingVertical: 16,
    },
    outerContainer: {
        backgroundColor: "#456",
        bottom: Platform.OS === "ios" ? 82 : 0,
    },
    scrollContainer: {},
    listContainer: {
        width: 360,
        maxWidth: "100%",
        marginHorizontal: "auto",
    },
});
