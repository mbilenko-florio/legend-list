package org.legend_list.flash_list_autolayout

import android.util.Log
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewGroupManager
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.ALCellContainerManagerDelegate
import com.facebook.react.viewmanagers.ALCellContainerManagerInterface

@ReactModule(name = "ALCellContainerManager.REACT_CLASS")
class ALCellContainerManager: ViewGroupManager<ALCellContainerImpl>(), ALCellContainerManagerInterface<ALCellContainerImpl> {
    private val mDelegate: ALCellContainerManagerDelegate<ALCellContainerImpl, ALCellContainerManager>
        = ALCellContainerManagerDelegate(this)

    companion object {
        const val REACT_CLASS = "ALCellContainer"
    }

    override fun getName(): String {
        Log.d("ALAutoLayoutPackage", REACT_CLASS)
        return REACT_CLASS
    }

    override fun getDelegate(): ViewManagerDelegate<ALCellContainerImpl> = mDelegate

    override fun createViewInstance(context: ThemedReactContext): ALCellContainerImpl {
        return ALCellContainerImpl(context)
    }

    @ReactProp(name = "index")
    override fun setIndex(view: ALCellContainerImpl, index: Int) {
        view.index = index
    }
}
