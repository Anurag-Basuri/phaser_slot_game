"""
Stake Engine SDK — Symbol Class

Symbols are handled as their own distinct class objects. Based on a symbol name,
attributes are assigned based on whether the name appears in config.paytable
or config.special_symbols fields.
"""


class Symbol:
    """
    Represents a single symbol on the game board.
    
    Attributes:
        name (str): Shorthand symbol name (e.g., "L3", "H1", "S")
        special (bool): True if symbol appears in config.special_symbols
        is_paying (bool): True if symbol appears in config.paytable
        paytable (dict|None): Paytable values for this symbol if paying
        special_functions (list): Callables assigned via GameStateOverride
        explode (bool): True if this symbol should be removed during tumble
        reel (int): Column index on the board
        row (int): Row index on the board
    """

    def __init__(self, config, name: str, reel: int = -1, row: int = -1) -> None:
        self.name = name
        self.reel = reel
        self.row = row
        self.special_functions = []
        self.special = False
        self.explode = False
        self._attributes = {}

        # Assign special properties from config
        is_special = False
        for special_property in config.special_symbols.keys():
            if name in config.special_symbols[special_property]:
                setattr(self, special_property, True)
                is_special = True

        if is_special:
            self.special = True

        # Assign paying properties
        self.assign_paying_bool(config)

        # Get symbol ID from config
        self.id = config.symbol_ids.get(name, -1)

    def assign_paying_bool(self, config) -> None:
        """
        Assigns is_paying and paytable based on whether
        the symbol name appears in config.paytable.
        """
        self.is_paying = False
        self.paytable = None

        # Check if any (kind, name) key in paytable matches this symbol
        matching_pays = {}
        for (kind, sym_name), payout in config.paytable.items():
            if sym_name == self.name:
                matching_pays[kind] = payout

        if matching_pays:
            self.is_paying = True
            self.paytable = matching_pays

    def check_attribute(self, *args) -> bool:
        """
        Returns True if any of the given attribute names exist
        and their value is not False/None.
        """
        for attr in args:
            # Check instance attributes first
            val = getattr(self, attr, None)
            if val is not None and val is not False:
                return True
            # Then check dynamic attributes
            if attr in self._attributes:
                val = self._attributes[attr]
                if val is not None and val is not False:
                    return True
        return False

    def get_attribute(self, attr: str):
        """
        Returns the value of a given attribute.
        Checks instance attributes first, then dynamic attributes.
        """
        val = getattr(self, attr, None)
        if val is not None:
            return val
        return self._attributes.get(attr, None)

    def assign_attribute(self, attrs: dict) -> None:
        """
        Assigns one or more dynamic attributes to this symbol.
        Example: symbol.assign_attribute({"multiplier": 5, "prize": 100})
        """
        for key, value in attrs.items():
            self._attributes[key] = value

    def run_special_functions(self, gamestate) -> None:
        """
        Executes all special functions assigned to this symbol.
        Called after the symbol is created on the board.
        """
        for func in self.special_functions:
            func(self)

    def to_dict(self, special_attributes: list = None) -> dict:
        """
        Converts to a JSON-serializable dictionary for event emission.

        Args:
            special_attributes: List of extra attribute names to include
                                if their value is not False/None.
        """
        result = {
            "symbol": self.name,
            "id": self.id,
            "reel": self.reel,
            "row": self.row,
        }

        if special_attributes:
            for attr in special_attributes:
                val = self.get_attribute(attr)
                if val is not None and val is not False:
                    result[attr] = val

        return result

    def __repr__(self):
        return f"Symbol({self.name}, r={self.row}, c={self.reel})"
