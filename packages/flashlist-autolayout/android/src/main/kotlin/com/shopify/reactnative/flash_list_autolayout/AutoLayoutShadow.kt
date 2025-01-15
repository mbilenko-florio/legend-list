package org.legend_list.flash_list_autolayout

import android.util.Log

class AutoLayoutShadow {
    var horizontal: Boolean = false
    var scrollOffset: Int = 0
    var offsetFromStart: Int = 0
    var windowSize: Int = 0
    var renderOffset = 0

    var blankOffsetAtStart = 0 // Tracks blank area from the top
    var blankOffsetAtEnd = 0 // Tracks blank area from the bottom

    var lastMaxBoundOverall = 0 // Tracks where the last pixel is drawn in the overall

    private var lastMaxBound = 0 // Tracks where the last pixel is drawn in the visible window
    private var lastMinBound = 0 // Tracks where first pixel is drawn in the visible window

    /** Checks for overlaps or gaps between adjacent items and then applies a correction (Only Grid layouts with varying spans)
     * Performance: RecyclerListView renders very small number of views and this is not going to trigger multiple layouts on Android side. Not expecting any major perf issue. */
    fun clearGapsAndOverlaps(sortedItems: Array<CellContainer>) {
        var maxBound = 0
        var minBound = Int.MAX_VALUE
        var maxBoundNeighbour = 0
        lastMaxBoundOverall = 0
        Log.d("LEGENDLIST", "fixlayout ${sortedItems.size}")
        for (i in 0 until sortedItems.size - 1) {
            val cell = sortedItems[i]
            var top = cell.top
            var index = cell.index
            Log.d("LEGENDLIST", "clearGapsAndOverlaps $i $top idx: $index t:${cell.top} b: ${cell.bottom}  l:${cell.left} r:${cell.right}")

            val neighbour = sortedItems[i + 1]
            Log.d("LEGENDLIST", "neighbour ${neighbour.index} t:${neighbour.top} b:${neighbour.bottom} l:${neighbour.left} r:${neighbour.right}")
            // Only apply correction if the next cell is consecutive.
            val isNeighbourConsecutive = neighbour.index == cell.index + 1 || neighbour.index == 100000
            if (isWithinBounds(cell) || isWithinBounds(neighbour)) {
                if (!horizontal) {
                    maxBound = kotlin.math.max(maxBound, cell.bottom);
                    minBound = kotlin.math.min(minBound, cell.top);
                    maxBoundNeighbour = maxBound
                    if (isNeighbourConsecutive) {
                        if (cell.left < neighbour.left) {
                            if (cell.right != neighbour.left) {
                                neighbour.right = cell.right + neighbour.width
                                neighbour.left = cell.right
                            }
                            if (cell.top != neighbour.top) {
                                neighbour.bottom = cell.top + neighbour.height
                                neighbour.top = cell.top
                            }
                        } else {
                            neighbour.bottom = maxBound + neighbour.height
                            neighbour.top = maxBound
                           Log.d("LEGENDLIST", "->adjusting neighbour  neighbour.top ${neighbour.top} bottom ${neighbour.bottom}" )
                        }
                    }
                    if (isWithinBounds(neighbour)) {
                        maxBoundNeighbour = kotlin.math.max(maxBound, neighbour.bottom)
                    }
                } else {
                    maxBound = kotlin.math.max(maxBound, cell.right);
                    minBound = kotlin.math.min(minBound, cell.left);
                    maxBoundNeighbour = maxBound
                    if (isNeighbourConsecutive) {
                        if (cell.top < neighbour.top) {
                            if (cell.bottom != neighbour.top) {
                                neighbour.bottom = cell.bottom + neighbour.height
                                neighbour.top = cell.bottom
                            }
                            if (cell.left != neighbour.left) {
                                neighbour.right = cell.left + neighbour.width
                                neighbour.left = cell.left
                            }
                        } else {
                            neighbour.right = maxBound + neighbour.width
                            neighbour.left = maxBound
                        }
                    }
                    if (isWithinBounds(neighbour)) {
                        maxBoundNeighbour = kotlin.math.max(maxBound, neighbour.right)
                    }
                }
            }
            lastMaxBoundOverall = kotlin.math.max(lastMaxBoundOverall, if (horizontal) cell.right else cell.bottom)
            lastMaxBoundOverall = kotlin.math.max(lastMaxBoundOverall, if (horizontal) neighbour.right else neighbour.bottom)
        }
        lastMaxBound = maxBoundNeighbour
        lastMinBound = minBound
    }

    /** Offset provided by react can be one frame behind the real one, it's important that this method is called with offset taken directly from
     * scrollview object */
    fun computeBlankFromGivenOffset(actualScrollOffset: Int, distanceFromWindowStart: Int, distanceFromWindowEnd: Int): Int {
        val actualScrollOffset = actualScrollOffset - offsetFromStart;
        blankOffsetAtStart = lastMinBound - actualScrollOffset - distanceFromWindowStart
        blankOffsetAtEnd = actualScrollOffset + windowSize - renderOffset - lastMaxBound - distanceFromWindowEnd
        return kotlin.math.max(blankOffsetAtStart, blankOffsetAtEnd)
    }

    /** It's important to avoid correcting views outside the render window. An item that isn't being recycled might still remain in the view tree. If views outside get considered then gaps between
     * unused items will cause algorithm to fail.*/
    private fun isWithinBounds(cell: CellContainer): Boolean {
        return true;
    }
}
