"""Electrical design of one system: inverter size, DC bus voltage, battery bank.

These values do not change the hourly energy balance; they size the power
equipment around the PV / wind / battery quantities chosen by PSO.

Inverter (hybrid)
    required = max( safety_factor x peak load ,  generator kW / max DC/AC ratio )
    rounded UP to a standard size; above the largest standard size identical
    units are put in parallel.

DC bus
    voltage from the inverter power (config.DC_BUS): 12 / 24 / 48 V.

Battery bank (LiFePO4)
    cells in series per pack = V_bus / 3        (4 / 8 / 16)
    pack voltage            = cells x 3.2 V     (12.8 / 25.6 / 51.2 V)
    packs in parallel       = number of batteries chosen by PSO
    bank capacity (Ah)      = nominal kWh x 1000 / pack voltage

Currents (I = P / V)
    on the DC bus at the full power of ONE inverter unit, at the C-rate limits of the
    battery, and of the PV array and wind turbines at the bus voltage.
"""

import math

from config import DC_BUS, SYSTEM


def generator_kw(design) -> float:
    return (
        design["pv_count"] * design["pv"]["rated_w"] / 1000.0
        + design["wind_count"] * design["wind"]["rated_kw"]
    )


def size_inverter(design) -> dict:
    """Inverter needed by a design (zero when there is no generator)."""
    gen_kw = generator_kw(design)
    peak = design.get("peak_load_kw", 0.0)

    if gen_kw <= 0:
        return {
            "required_kw": 0.0, "unit_kw": 0.0, "units": 0, "rated_kw": 0.0,
            "by_load_kw": 0.0, "by_generator_kw": 0.0, "dc_ac_ratio": None,
        }

    by_load = SYSTEM["inverter_safety_factor"] * peak
    by_generator = gen_kw / SYSTEM["inverter_max_dc_ac_ratio"]
    required = max(by_load, by_generator)

    sizes = sorted(SYSTEM["inverter_standard_sizes_kw"])
    largest = sizes[-1]

    units = max(1, math.ceil(required / largest - 1e-9))
    per_unit = required / units
    unit_kw = next((s for s in sizes if s >= per_unit - 1e-9), largest)
    rated = units * unit_kw

    return {
        "required_kw": required,
        "unit_kw": unit_kw,
        "units": units,
        "rated_kw": rated,
        "by_load_kw": by_load,
        "by_generator_kw": by_generator,
        "dc_ac_ratio": gen_kw / rated if rated > 0 else None,
    }


def bus_voltage(power_kw: float) -> int:
    for up_to_kw, volts in DC_BUS["voltage_steps"]:
        if power_kw <= up_to_kw:
            return volts
    return DC_BUS["default_voltage_v"]


def system_design(final) -> dict:
    """Full electrical design of a simulated system (`final` from simulate)."""
    inverter = size_inverter(final)
    battery = final["battery"]

    if inverter["rated_kw"] <= 0:
        return {"dc_bus_v": None, "inverter": inverter, "battery": None,
                "currents": None, "generator_kw": 0.0,
                "peak_load_kw": round(final["peak_load_kw"], 2)}

    v_bus = bus_voltage(inverter["rated_kw"])

    bank = None
    battery_count = final["battery_count"]
    if battery_count > 0:
        cells = round(v_bus / 3.0)
        pack_v = cells * battery["cell_voltage_v"]
        nominal_per_pack = battery["usable_kwh"] / (1.0 - battery["minimum_soc"])
        bank = {
            "chemistry": battery.get("chemistry", ""),
            "cell_voltage_v": battery["cell_voltage_v"],
            "cells_series": cells,
            "pack_voltage_v": round(pack_v, 1),
            "packs_parallel": battery_count,
            "pack_ah": round(nominal_per_pack * 1000.0 / pack_v, 0),
            "bank_ah": round(battery_count * nominal_per_pack * 1000.0 / pack_v, 0),
            "nominal_kwh": round(final["battery_nominal_kwh"], 2),
            "c_rate_charge": battery.get("max_charge_c_rate"),
            "c_rate_discharge": battery.get("max_discharge_c_rate"),
            "max_charge_kw": round(final["max_charge_kw"], 2),
            "max_discharge_kw": round(final["max_discharge_kw"], 2),
            "max_charge_a": round(final["max_charge_kw"] * 1000.0 / pack_v, 0),
            "max_discharge_a": round(final["max_discharge_kw"] * 1000.0 / pack_v, 0),
            "charge_limited_hours": final["charge_limited_hours"],
            "discharge_limited_hours": final["discharge_limited_hours"],
        }

    pv_kw = final["pv_count"] * final["pv"]["rated_w"] / 1000.0
    wind_kw = final["wind_count"] * final["wind"]["rated_kw"]

    return {
        "dc_bus_v": v_bus,
        "generator_kw": round(pv_kw + wind_kw, 2),
        "peak_load_kw": round(final["peak_load_kw"], 2),
        "inverter": {
            "required_kw": round(inverter["required_kw"], 2),
            "by_load_kw": round(inverter["by_load_kw"], 2),
            "by_generator_kw": round(inverter["by_generator_kw"], 2),
            "unit_kw": inverter["unit_kw"],
            "units": inverter["units"],
            "rated_kw": inverter["rated_kw"],
            "dc_ac_ratio": (
                round(inverter["dc_ac_ratio"], 2)
                if inverter["dc_ac_ratio"] is not None else None
            ),
            "safety_factor": SYSTEM["inverter_safety_factor"],
            "max_dc_ac_ratio": SYSTEM["inverter_max_dc_ac_ratio"],
        },
        "battery": bank,
        "currents": {
            # each inverter unit draws its own current from the bus
            "inverter_dc_a": round(inverter["unit_kw"] * 1000.0 / v_bus, 0),
            "pv_a": round(pv_kw * 1000.0 / v_bus, 0),
            "wind_a": round(wind_kw * 1000.0 / v_bus, 0),
        },
    }
