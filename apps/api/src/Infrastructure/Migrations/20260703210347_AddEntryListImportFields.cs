using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ImsaFantasy.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddEntryListImportFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_entry_driver_car_entry_id_driver_id",
                table: "entry_driver");

            migrationBuilder.AddColumn<bool>(
                name: "is_coach",
                table: "entry_driver",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "is_rookie",
                table: "entry_driver",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "rating",
                table: "entry_driver",
                type: "character varying(8)",
                maxLength: 8,
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "round_id",
                table: "entry_driver",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "slot_order",
                table: "entry_driver",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "bronze_cup",
                table: "car_entry",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "car_model",
                table: "car_entry",
                type: "text",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_entry_driver_car_entry_id_driver_id_round_id",
                table: "entry_driver",
                columns: new[] { "car_entry_id", "driver_id", "round_id" },
                unique: true)
                .Annotation("Npgsql:NullsDistinct", false);

            migrationBuilder.CreateIndex(
                name: "ix_entry_driver_round_id",
                table: "entry_driver",
                column: "round_id");

            migrationBuilder.AddForeignKey(
                name: "fk_entry_driver_rounds_round_id",
                table: "entry_driver",
                column: "round_id",
                principalTable: "round",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_entry_driver_rounds_round_id",
                table: "entry_driver");

            migrationBuilder.DropIndex(
                name: "ix_entry_driver_car_entry_id_driver_id_round_id",
                table: "entry_driver");

            migrationBuilder.DropIndex(
                name: "ix_entry_driver_round_id",
                table: "entry_driver");

            migrationBuilder.DropColumn(
                name: "is_coach",
                table: "entry_driver");

            migrationBuilder.DropColumn(
                name: "is_rookie",
                table: "entry_driver");

            migrationBuilder.DropColumn(
                name: "rating",
                table: "entry_driver");

            migrationBuilder.DropColumn(
                name: "round_id",
                table: "entry_driver");

            migrationBuilder.DropColumn(
                name: "slot_order",
                table: "entry_driver");

            migrationBuilder.DropColumn(
                name: "bronze_cup",
                table: "car_entry");

            migrationBuilder.DropColumn(
                name: "car_model",
                table: "car_entry");

            migrationBuilder.CreateIndex(
                name: "ix_entry_driver_car_entry_id_driver_id",
                table: "entry_driver",
                columns: new[] { "car_entry_id", "driver_id" },
                unique: true);
        }
    }
}
