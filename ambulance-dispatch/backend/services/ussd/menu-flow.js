/**
 * Menu Flow - USSD Menu Tree
 * Defines the hierarchical menu structure and navigation flow
 * 1=Medical Emergency, 2=Accident, 3=Track Ambulance, 4=Cancel
 */

class MenuFlow {
  constructor() {
    this.menus = this.defineMenus();
  }

  /**
   * Define all menus in the USSD system
   */
  defineMenus() {
    return {
      // Main menu
      main: {
        message: 'Welcome to Emergency Services\n\nSelect service:',
        type: 'menu',
        options: {
          '1': 'Medical Emergency',
          '2': 'Accident Report',
          '3': 'Track Ambulance',
          '4': 'Cancel',
        },
      },

      // Medical emergency sub-menu
      'emergency-type': {
        message: 'Select medical emergency type:',
        type: 'menu',
        options: {
          '1': 'Chest Pain',
          '2': 'Difficulty Breathing',
          '3': 'Unconscious/Collapsed',
          '4': 'Severe Bleeding',
          '5': 'Back to Main Menu',
        },
      },

      // Confirmation menu
      confirm: {
        message: (context) => {
          let msg = 'Confirm dispatch:';

          if (context.emergencyType === 'accident') {
            msg += '\nEmergency Type: Accident';
          } else if (context.emergencyType === 'medical') {
            msg += `\nEmergency Type: Medical\nCondition: ${this.getConditionName(
              context.medicalCondition
            )}`;
          }

          if (context.location) {
            msg += `\nLocation: ${context.location.area || 'Auto-detected'}`;
          }

          msg += '\n\nProceed?';
          return msg;
        },
        type: 'confirmation',
        options: {
          '1': 'Yes, Dispatch Ambulance',
          '2': 'Back',
        },
      },

      // Tracking menu
      track: {
        message: 'Track Ambulance Status\n\nPress 1 to get ambulance ETA\nPress 2 to go back',
        type: 'menu',
        options: {
          '1': 'Get ETA',
          '2': 'Back to Main Menu',
        },
      },

      // Tracking info display
      'tracking-info': {
        message: (context) => {
          return `Ambulance En Route\n\nPlate: ${context.ambulancePlate || 'N/A'}\nETA: ${
            context.ambulanceEta || 'N/A'
          } minutes\n\nPress any key to continue`;
        },
        type: 'end',
        options: {},
      },

      // Dispatched success
      dispatched: {
        message: (context) => {
          return `Ambulance Dispatched!\n\nIncident ID: ${context.incidentId || ''}\nAmbulance en route to your location.\n\nPress 1 to track ambulance\nPress 2 to return home`;
        },
        type: 'info',
        options: {
          '1': 'Track Ambulance',
          '2': 'Return Home',
        },
      },

      // Dispatch error
      'dispatch-error': {
        message: 'Error sending dispatch. Please call 911 directly.\n\nPress any key to continue',
        type: 'end',
        options: {},
      },

      // No active dispatch
      'no-active-dispatch': {
        message: 'No active ambulance dispatch found.\n\nWould you like to request one?\nPress 1 for Yes\nPress 2 for No',
        type: 'menu',
        options: {
          '1': 'Request Ambulance',
          '2': 'Go Back',
        },
      },

      // Tracking error
      'tracking-error': {
        message: 'Error retrieving tracking information.\n\nPress any key to return home',
        type: 'end',
        options: {},
      },

      // Session cancelled
      cancelled: {
        message: 'Request cancelled. Thank you for using Emergency Services.',
        type: 'end',
        options: {},
      },

      // Session timeout
      timeout: {
        message: 'Session timeout. Please try again.',
        type: 'end',
        options: {},
      },

      // Exceeded max retries
      'exceeded-retries': {
        message: 'Maximum attempts exceeded. Please try again later or call 911 directly.',
        type: 'end',
        options: {},
      },
    };
  }

  /**
   * Get menu response with proper formatting
   * Supports dynamic message generation based on context
   */
  getMenuResponse(menuKey, context = {}) {
    const menu = this.menus[menuKey] || this.menus.main;

    return {
      ...menu,
      message:
        typeof menu.message === 'function' ? menu.message(context) : menu.message,
    };
  }

  /**
   * Get human-readable condition name
   */
  getConditionName(conditionCode) {
    const conditions = {
      'chest-pain': 'Chest Pain',
      'difficulty-breathing': 'Difficulty Breathing',
      'unconscious': 'Unconscious/Collapsed',
      'severe-bleeding': 'Severe Bleeding',
    };
    return conditions[conditionCode] || 'Unknown';
  }

  /**
   * Get next menu based on current menu and user action
   * Useful for validation and flow analysis
   */
  getNextMenu(currentMenu, userInput, context = {}) {
    const menu = this.menus[currentMenu];
    if (!menu || !menu.options[userInput]) {
      return null; // Invalid input
    }

    // Define flow transitions
    const transitions = {
      main: {
        '1': 'emergency-type',
        '2': 'confirm', // Accident
        '3': 'track',
        '4': 'cancelled',
      },
      'emergency-type': {
        '1': 'confirm',
        '2': 'confirm',
        '3': 'confirm',
        '4': 'confirm',
        '5': 'main',
      },
      confirm: {
        '1': 'dispatched',
        '2': context.emergencyType === 'medical' ? 'emergency-type' : 'main',
      },
      track: {
        '1': 'tracking-info',
        '2': 'main',
      },
    };

    return transitions[currentMenu]?.[userInput] || null;
  }

  /**
   * Validate user input for a given menu
   */
  validateInput(menuKey, userInput) {
    const menu = this.menus[menuKey];
    if (!menu) {
      return { valid: false, error: 'Menu not found' };
    }

    if (!menu.options[userInput]) {
      const validOptions = Object.keys(menu.options).join(', ');
      return {
        valid: false,
        error: `Invalid input. Valid options: ${validOptions}`,
      };
    }

    return { valid: true };
  }

  /**
   * Get all possible menu paths (for testing/documentation)
   */
  getMenuPaths() {
    return {
      medicalEmergency: ['main(1)', 'emergency-type(1-4)', 'confirm(1)', 'dispatched'],
      accident: ['main(2)', 'confirm(1)', 'dispatched'],
      trackAmbulance: ['main(3)', 'track(1)', 'tracking-info'],
      cancel: ['main(4)', 'cancelled'],
    };
  }

  /**
   * Build a visual tree of the menu structure
   */
  getMenuTree() {
    return `
USSD Menu Structure
===================

Main Menu (main)
├── 1: Medical Emergency
│   └── Emergency Type (emergency-type)
│       ├── 1: Chest Pain
│       ├── 2: Difficulty Breathing
│       ├── 3: Unconscious/Collapsed
│       ├── 4: Severe Bleeding
│       └── 5: Back to Main
│           └── Confirmation (confirm)
│               ├── 1: Confirm & Dispatch
│               │   └── Dispatched (dispatched)
│               └── 2: Back to Emergency Type
│
├── 2: Accident Report
│   └── Confirmation (confirm)
│       ├── 1: Confirm & Dispatch
│       │   └── Dispatched (dispatched)
│       └── 2: Back to Main
│
├── 3: Track Ambulance
│   └── Tracking (track)
│       ├── 1: Get ETA
│       │   └── Tracking Info (tracking-info)
│       └── 2: Back to Main
│
└── 4: Cancel
    └── Cancelled (cancelled)
    `;
  }
}

module.exports = MenuFlow;
