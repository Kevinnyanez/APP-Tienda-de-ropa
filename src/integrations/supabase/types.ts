export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      articulos: {
        Row: {
          activo: boolean | null
          categoria: string | null
          codigo: string
          created_at: string | null
          descripcion: string | null
          fecha_alta: string | null
          id_articulo: string
          nombre: string
          precio_costo: number
          precio_venta: number
          stock_disponible: number
          stock_reservado: number
        }
        Insert: {
          activo?: boolean | null
          categoria?: string | null
          codigo: string
          created_at?: string | null
          descripcion?: string | null
          fecha_alta?: string | null
          id_articulo?: string
          nombre: string
          precio_costo?: number
          precio_venta?: number
          stock_disponible?: number
          stock_reservado?: number
        }
        Update: {
          activo?: boolean | null
          categoria?: string | null
          codigo?: string
          created_at?: string | null
          descripcion?: string | null
          fecha_alta?: string | null
          id_articulo?: string
          nombre?: string
          precio_costo?: number
          precio_venta?: number
          stock_disponible?: number
          stock_reservado?: number
        }
        Relationships: []
      }
      clientes: {
        Row: {
          activo: boolean | null
          apellido: string
          created_at: string | null
          direccion: string | null
          dni: string | null
          email: string | null
          fecha_alta: string | null
          id_cliente: string
          nombre: string
          telefono: string | null
        }
        Insert: {
          activo?: boolean | null
          apellido: string
          created_at?: string | null
          direccion?: string | null
          dni?: string | null
          email?: string | null
          fecha_alta?: string | null
          id_cliente?: string
          nombre: string
          telefono?: string | null
        }
        Update: {
          activo?: boolean | null
          apellido?: string
          created_at?: string | null
          direccion?: string | null
          dni?: string | null
          email?: string | null
          fecha_alta?: string | null
          id_cliente?: string
          nombre?: string
          telefono?: string | null
        }
        Relationships: []
      }
      detalle_venta: {
        Row: {
          cantidad: number
          created_at: string | null
          estado_articulo: string
          id_articulo: string | null
          id_detalle: string
          id_venta: string
          precio_unitario: number
        }
        Insert: {
          cantidad?: number
          created_at?: string | null
          estado_articulo: string
          id_articulo?: string | null
          id_detalle?: string
          id_venta: string
          precio_unitario: number
        }
        Update: {
          cantidad?: number
          created_at?: string | null
          estado_articulo?: string
          id_articulo?: string | null
          id_detalle?: string
          id_venta?: string
          precio_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "detalle_venta_id_articulo_fkey"
            columns: ["id_articulo"]
            isOneToOne: false
            referencedRelation: "articulos"
            referencedColumns: ["id_articulo"]
          },
          {
            foreignKeyName: "detalle_venta_id_venta_fkey"
            columns: ["id_venta"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id_venta"]
          },
        ]
      }
      movimientos_caja: {
        Row: {
          created_at: string | null
          descripcion: string | null
          fecha: string | null
          id_movimiento: string
          id_venta: string | null
          medio_pago: string | null
          monto: number
          tipo: string
        }
        Insert: {
          created_at?: string | null
          descripcion?: string | null
          fecha?: string | null
          id_movimiento?: string
          id_venta?: string | null
          medio_pago?: string | null
          monto: number
          tipo: string
        }
        Update: {
          created_at?: string | null
          descripcion?: string | null
          fecha?: string | null
          id_movimiento?: string
          id_venta?: string | null
          medio_pago?: string | null
          monto?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_caja_id_venta_fkey"
            columns: ["id_venta"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id_venta"]
          },
        ]
      }
      ventas: {
        Row: {
          created_at: string | null
          estado: string
          fecha: string | null
          id_cliente: string | null
          id_venta: string
          observaciones: string | null
          tipo_pago: string | null
          total: number
        }
        Insert: {
          created_at?: string | null
          estado: string
          fecha?: string | null
          id_cliente?: string | null
          id_venta?: string
          observaciones?: string | null
          tipo_pago?: string | null
          total?: number
        }
        Update: {
          created_at?: string | null
          estado?: string
          fecha?: string | null
          id_cliente?: string | null
          id_venta?: string
          observaciones?: string | null
          tipo_pago?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "ventas_id_cliente_fkey"
            columns: ["id_cliente"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id_cliente"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
