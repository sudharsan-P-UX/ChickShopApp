import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_state.dart';
import 'billing_screen.dart';
import 'overview_screen.dart';
import 'cart_screen.dart';
import 'pending_orders_screen.dart';
import 'inventory_screen.dart';
import 'customers_screen.dart';
import 'users_screen.dart';
import 'labels_screen.dart';
import 'custom_bill_screen.dart';
import 'custom_cart_screen.dart';
import 'custom_pending_screen.dart';
import 'custom_inventory_screen.dart';
import 'menu_order_screen.dart';
import 'menu_control_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final state = Provider.of<AppState>(context, listen: false);
      if (state.menuOrders.isEmpty) {
        state.fetchMenuOrders();
      }
    });
  }

  final List<Widget> _screens = [
    const BillingScreen(),
    const OverviewScreen(),
    const CartScreen(),
    const PendingOrdersScreen(),
    const InventoryScreen(),
    const CustomersScreen(),
    const UsersScreen(),
    const LabelsScreen(),
    const CustomBillScreen(),
    const CustomCartScreen(),
    const CustomPendingScreen(),
    const CustomInventoryScreen(),
    const MenuControlScreen(),
    const MenuOrderScreen(),
  ];

  String _getScreenTitle(int index, AppState appState) {
    switch (index) {
      case 0:
        return appState.getLabel('billing_menu', 'Billing & POS');
      case 1:
        return appState.getLabel('overview_menu', 'Overview');
      case 2:
        return appState.getLabel('view_cart_details', 'View Cart Details');
      case 3:
        return appState.getLabel('pending_orders', 'Pending Orders');
      case 4:
        return appState.getLabel('inventory_menu', 'Inventory Control');
      case 5:
        return appState.getLabel('customers_menu', 'Customer Directory');
      case 6:
        return appState.getLabel('users_menu', 'User Management');
      case 7:
        return appState.getLabel('custom_labels_menu', 'Custom Label');
      case 8:
        return appState.getLabel('custom_bill_menu', 'Custom Bill');
      case 9:
        return appState.getLabel('custom_view_cart', 'View Custom Cart');
      case 10:
        return appState.getLabel('custom_pending_orders', 'Custom Pending Orders');
      case 11:
        return appState.getLabel('custom_inventory_menu', 'Custom Bill Inventory');
      case 12:
        return appState.getLabel('menu_control_menu', 'Menu Control');
      case 13:
        return appState.getLabel('menu_order_menu', 'Menu Order');
      default:
        return 'Chicken Shop POS';
    }
  }

  @override
  Widget build(BuildContext context) {
    final appState = Provider.of<AppState>(context);
    
    int index = appState.screenIndex;

    // Check permissions dynamically
    String? menuKey;
    switch (index) {
      case 1: menuKey = 'dashboard'; break;
      case 2: menuKey = 'cart'; break;
      case 3: menuKey = 'pending'; break;
      case 4: menuKey = 'inventory'; break;
      case 5: menuKey = 'customers'; break;
      case 6: menuKey = 'users'; break;
      case 7: menuKey = 'custom_labels'; break;
      case 8: menuKey = 'custom_bill'; break;
      case 9: menuKey = 'custom_bill'; break;
      case 10: menuKey = 'custom_bill'; break;
      case 11: menuKey = 'custom_bill_inventory'; break;
      case 12: menuKey = 'menu_control'; break;
      case 13: menuKey = 'menu_order'; break;
    }
    if (menuKey != null && !appState.hasPermission(menuKey, 'view')) {
      index = 0; // Fallback to Billing POS
    }

    return Scaffold(
      appBar: AppBar(
        leading: (index != 0 && index != 8)
            ? IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: () {
                  if (index >= 8 && index <= 11) {
                    appState.setScreenIndex(8);
                  } else {
                    appState.setScreenIndex(0);
                  }
                },
              )
            : null,
        title: Text(_getScreenTitle(index, appState)),
        elevation: 2,
        actions: [
          if (index == 0 && appState.hasPermission('cart', 'view')) // Billing screen cart icon shortcut
            Stack(
              alignment: Alignment.center,
              children: [
                IconButton(
                  icon: const Icon(Icons.shopping_cart),
                  onPressed: () => appState.setScreenIndex(2), // go to View Cart
                ),
                if (appState.cartCount > 0)
                  Positioned(
                    right: 8,
                    top: 8,
                    child: Container(
                      padding: const EdgeInsets.all(2),
                      decoration: BoxDecoration(
                        color: Colors.red,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      constraints: const BoxConstraints(
                        minWidth: 16,
                        minHeight: 16,
                      ),
                      child: Text(
                        '${appState.cartCount}',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
              ],
            ),
          if (index == 8 && appState.hasPermission('custom_bill', 'view')) // Custom Bill screen cart icon shortcut
            Stack(
              alignment: Alignment.center,
              children: [
                IconButton(
                  icon: const Icon(Icons.shopping_cart),
                  onPressed: () => appState.setScreenIndex(9), // go to Custom Cart
                ),
                if (appState.customCartCount > 0)
                  Positioned(
                    right: 8,
                    top: 8,
                    child: Container(
                      padding: const EdgeInsets.all(2),
                      decoration: BoxDecoration(
                        color: Colors.red,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      constraints: const BoxConstraints(
                        minWidth: 16,
                        minHeight: 16,
                      ),
                      child: Text(
                        '${appState.customCartCount}',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
              ],
            ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => appState.logout(),
          ),
        ],
      ),
      drawer: _buildDynamicDrawer(context, appState),
      body: SafeArea(
        child: _screens[index],
      ),
    );
  }

  Widget _buildDynamicDrawer(BuildContext context, AppState appState) {
    // Group menuOrders by main_menu
    final Map<String, List<dynamic>> groups = {};
    for (var m in appState.menuOrders) {
      final String group = m['main_menu'] ?? 'Other';
      if (!groups.containsKey(group)) {
        groups[group] = [];
      }
      groups[group]!.add(m);
    }

    final List<String> groupsOrder = [
      'Create Billing',
      'Cart',
      'Orders',
      'Dashboards',
      'Customer',
      'Admin'
    ];

    final List<Widget> drawerWidgets = [];

    drawerWidgets.add(
      UserAccountsDrawerHeader(
        decoration: const BoxDecoration(color: Colors.deepOrange),
        accountName: Text(
          appState.username.toUpperCase(),
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
        ),
        accountEmail: Text(
          'Role: ${appState.userRole.toUpperCase()}',
          style: TextStyle(color: Colors.white.withOpacity(0.8)),
        ),
        currentAccountPicture: CircleAvatar(
          backgroundColor: Colors.white,
          child: appState.getLabel('app_logo', '').isNotEmpty
              ? ClipOval(
                  child: Image.network(
                    appState.getLabel('app_logo', ''),
                    width: 72,
                    height: 72,
                    fit: BoxFit.cover,
                    errorBuilder: (context, error, stackTrace) => const Icon(Icons.person, color: Colors.deepOrange, size: 40),
                  ),
                )
              : const Icon(Icons.person, color: Colors.deepOrange, size: 40),
        ),
      ),
    );

    final int index = appState.screenIndex;

    for (var groupName in groupsOrder) {
      if (!groups.containsKey(groupName)) continue;
      final List<dynamic> submenus = groups[groupName]!;

      final visibleSubmenus = submenus.where((item) {
        final String key = item['submenu_key'];
        return appState.isMenuVisible(key);
      }).toList();

      visibleSubmenus.sort((a, b) => (a['display_order'] as num).compareTo(b['display_order'] as num));

      if (visibleSubmenus.isEmpty) continue;

      IconData groupIcon = Icons.folder_open;
      switch (groupName) {
        case 'Create Billing':
          groupIcon = Icons.point_of_sale;
          break;
        case 'Cart':
          groupIcon = Icons.shopping_basket;
          break;
        case 'Orders':
          groupIcon = Icons.bookmark_border;
          break;
        case 'Dashboards':
          groupIcon = Icons.dashboard;
          break;
        case 'Customer':
          groupIcon = Icons.people;
          break;
        case 'Admin':
          groupIcon = Icons.business;
          break;
      }

      final List<Widget> childrenTiles = [];

      for (var item in visibleSubmenus) {
        final String key = item['submenu_key'];
        
        IconData itemIcon = Icons.link;
        String labelKey = '';
        String defaultLabel = '';
        int routeIndex = 0;
        Widget? trailingBadge;

        switch (key) {
          case 'billing':
            itemIcon = Icons.calculate_outlined;
            labelKey = 'billing_menu';
            defaultLabel = 'Billing & POS';
            routeIndex = 0;
            break;
          case 'custom_bill':
            itemIcon = Icons.scale_outlined;
            labelKey = 'custom_bill_menu';
            defaultLabel = 'Custom Bill';
            routeIndex = 8;
            break;
          case 'cart':
            itemIcon = Icons.shopping_cart_outlined;
            labelKey = 'view_cart';
            defaultLabel = 'View Cart';
            routeIndex = 2;
            if (appState.cartCount > 0) {
              trailingBadge = Badge(
                label: Text('${appState.cartCount}'),
                backgroundColor: Colors.red,
              );
            }
            break;
          case 'custom_cart':
            itemIcon = Icons.shopping_basket_outlined;
            labelKey = 'custom_view_cart';
            defaultLabel = 'View Custom Cart';
            routeIndex = 9;
            if (appState.customCartCount > 0) {
              trailingBadge = Badge(
                label: Text('${appState.customCartCount}'),
                backgroundColor: Colors.red,
              );
            }
            break;
          case 'pending':
            itemIcon = Icons.bookmark_outline;
            labelKey = 'pending_orders';
            defaultLabel = 'Pending Orders';
            routeIndex = 3;
            break;
          case 'custom_pending':
            itemIcon = Icons.bookmark_added_outlined;
            labelKey = 'custom_pending_orders';
            defaultLabel = 'Custom Pending Orders';
            routeIndex = 10;
            break;
          case 'dashboard':
            itemIcon = Icons.dashboard_outlined;
            labelKey = 'overview_menu';
            defaultLabel = 'Overview';
            routeIndex = 1;
            break;
          case 'customers':
            itemIcon = Icons.people_outline;
            labelKey = 'customers_menu';
            defaultLabel = 'Customer Directory';
            routeIndex = 5;
            break;
          case 'users':
            itemIcon = Icons.admin_panel_settings_outlined;
            labelKey = 'users_menu';
            defaultLabel = 'User Management';
            routeIndex = 6;
            break;
          case 'inventory':
            itemIcon = Icons.inventory_2_outlined;
            labelKey = 'inventory_menu';
            defaultLabel = 'Inventory Control';
            routeIndex = 4;
            break;
          case 'custom_bill_inventory':
            itemIcon = Icons.layers_outlined;
            labelKey = 'custom_inventory_menu';
            defaultLabel = 'Custom Bill Inventory';
            routeIndex = 11;
            break;
          case 'custom_labels':
            itemIcon = Icons.create_outlined;
            labelKey = 'custom_labels_menu';
            defaultLabel = 'Custom Label';
            routeIndex = 7;
            break;
          case 'menu_control':
            itemIcon = Icons.options_outlined;
            labelKey = 'menu_control_menu';
            defaultLabel = 'Menu Control';
            routeIndex = 12;
            break;
          case 'menu_order':
            itemIcon = Icons.list_alt_outlined;
            labelKey = 'menu_order_menu';
            defaultLabel = 'Menu Order';
            routeIndex = 13;
            break;
        }

        childrenTiles.add(
          ListTile(
            contentPadding: const EdgeInsets.only(left: 24, right: 16),
            leading: Icon(itemIcon),
            title: Text(appState.getLabel(labelKey, defaultLabel)),
            selected: index == routeIndex,
            trailing: trailingBadge,
            onTap: () {
              appState.setScreenIndex(routeIndex);
              Navigator.pop(context);
            },
          ),
        );
      }

      drawerWidgets.add(
        ExpansionTile(
          leading: Icon(groupIcon, color: Colors.deepOrange),
          title: Text(groupName, style: const TextStyle(fontWeight: FontWeight.bold)),
          initiallyExpanded: true,
          children: childrenTiles,
        ),
      );
    }

    drawerWidgets.add(const Divider());
    drawerWidgets.add(
      ListTile(
        leading: const Icon(Icons.logout, color: Colors.red),
        title: const Text('Sign Out', style: TextStyle(color: Colors.red)),
        onTap: () {
          Navigator.pop(context);
          appState.logout();
        },
      ),
    );

    return Drawer(
      child: Column(
        children: [
          Expanded(
            child: ListView(
              padding: EdgeInsets.zero,
              children: drawerWidgets,
            ),
          ),
        ],
      ),
    );
  }
}

class MenuControlPlaceholderScreen extends StatelessWidget {
  const MenuControlPlaceholderScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.options_outlined, size: 64, color: Colors.grey),
          SizedBox(height: 12),
          Text(
            'Menu Control Panel',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          SizedBox(height: 6),
          Text(
            'This panel is a placeholder for advanced route configurations.',
            style: TextStyle(color: Colors.grey),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
