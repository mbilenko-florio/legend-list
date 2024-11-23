import React from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { Link } from "expo-router";
import { LegendList } from "@legendapp/list";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemedText } from "@/components/ThemedText";

type ListElement = {
  id: number;
  title: string;
  url: "/initial-scroll-index";
};

const data: ListElement[] = [
  {
    id: 1,
    title: "Initial scroll index precise navigation",
    url: "/initial-scroll-index",
  },
  // Add more items as needed
];

const ListItem = ({ title, url }: ListElement) => (
  <Link href={url}>
    <View style={styles.item}>
      <ThemedText>{title}</ThemedText>
    </View>
  </Link>
);

const ListElements = () => {
  return (
    <SafeAreaView style={styles.container}>
      <LegendList
        estimatedItemSize={80}
        data={data}
        renderItem={({ item }) => <ListItem {...item} />}
        keyExtractor={(item) => item.id.toString()}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  item: {
    padding: 16,
    borderBottomColor: "#ccc",
    borderBottomWidth: 1,
    width: "100%",
  },
});

export default ListElements;
